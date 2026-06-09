use osm4routing::Edge;
use osm4routing::NodeId;
use schemas::infra::ApplicableDirections;
use schemas::infra::ApplicableDirectionsTrackRange;
use schemas::infra::Detector;
use schemas::infra::Electrification;
use schemas::infra::Signal;
use schemas::infra::Speed;
use schemas::infra::SpeedSection;
use schemas::infra::TrackSection;
use schemas::infra::TrackSectionExtensions;
use schemas::infra::TrackSectionSncfExtension;
use schemas::infra::TrackSectionSourceExtension;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;
use std::collections::HashMap;
use std::str::FromStr;

use tracing::error;
use tracing::warn;

/// When reading OpenStreetMap data, we sometimes need to match a Node to a Track and position
/// This struct maps the nodes to the Edges (a Way from OpenStreetMap that might have been split)
pub(crate) struct NodeToTrack<'a> {
    nodes_edges: HashMap<NodeId, Vec<&'a Edge>>,
}

impl<'a> NodeToTrack<'a> {
    pub fn from_edges(edges: &'a [Edge]) -> Self {
        let mut nodes_edges = HashMap::<NodeId, Vec<&Edge>>::new();
        for edge in edges {
            for node in &edge.nodes {
                nodes_edges.entry(*node).or_default().push(edge);
            }
        }
        Self { nodes_edges }
    }

    /// Given an OSM node, returns the track, the position it is on and the local ref if its available
    /// If there is an ambiguity (the node is at intersection), we just pick one
    /// We log weird situations (the are 3 edges for that node)
    pub fn track_and_position(
        &self,
        id: NodeId,
    ) -> Option<(Identifier, f64, Option<NonBlankString>)> {
        self.nodes_edges.get(&id).and_then(|edges| {
            if edges.is_empty() {
                error!("Missing edge for node {}", id.0);
                return None;
            } else if edges.len() >= 3 {
                warn!("Too many edges for node {}", id.0);
            }
            let local_ref = edges[0].tags.get("local_ref").map(NonBlankString::from);
            Some((
                edges[0].id.clone().into(),
                edges[0].length_until(&id),
                local_ref,
            ))
        })
    }
}

pub(crate) fn speed_sections(edge: &Edge) -> Vec<SpeedSection> {
    let speeds = match (
        edge.tags.get("maxspeed"),
        edge.tags.get("maxspeed:forward"),
        edge.tags.get("maxspeed:backward"),
    ) {
        (None, None, None) => vec![],
        (Some(default), None, None) => {
            vec![speed_section(edge, default, ApplicableDirections::Both)]
        }
        (Some(default), None, Some(backward)) => vec![
            speed_section(edge, default, ApplicableDirections::StartToStop),
            speed_section(edge, backward, ApplicableDirections::StopToStart),
        ],
        (Some(default), Some(forward), None) => vec![
            speed_section(edge, forward, ApplicableDirections::StartToStop),
            speed_section(edge, default, ApplicableDirections::StopToStart),
        ],
        (None, Some(forward), None) => vec![speed_section(
            edge,
            forward,
            ApplicableDirections::StartToStop,
        )],
        (None, None, Some(backward)) => vec![speed_section(
            edge,
            backward,
            ApplicableDirections::StopToStart,
        )],
        (_, Some(forward), Some(backward)) => vec![
            speed_section(edge, forward, ApplicableDirections::StartToStop),
            speed_section(edge, backward, ApplicableDirections::StopToStart),
        ],
    };
    speeds.into_iter().flatten().collect()
}

/// Builds a speed section from a speed limit
/// Handles both km/h and mph
/// If the speed limit is invalid, it will log a warning and return None
fn speed_section(edge: &Edge, limit: &String, dir: ApplicableDirections) -> Option<SpeedSection> {
    let speed_limit = if limit.ends_with("mph") {
        // We convert from mph to m/s
        let limit = limit.split("mph").next().unwrap_or_default().trim();
        f64::from_str(limit)
            .map(|speed| Speed(speed / 2.2369362920544))
            .ok()
    } else {
        // We convert from km/h to m/s
        f64::from_str(limit).map(|speed| Speed(speed / 3.6)).ok()
    };

    if speed_limit.is_none() || speed_limit.unwrap().0 <= 0. {
        warn!("Invalid speed limit '{limit}' for way {}", edge.osm_id.0);
        return None;
    }

    let id = match dir {
        ApplicableDirections::Both => edge.id.clone().into(),
        ApplicableDirections::StartToStop => format!("{}-forward", edge.id).into(),
        ApplicableDirections::StopToStart => format!("{}-backward", edge.id).into(),
    };
    Some(SpeedSection {
        id,
        speed_limit,
        track_ranges: vec![ApplicableDirectionsTrackRange::new(
            edge.id.clone(),
            0.,
            edge.length(),
            dir,
        )],
        ..Default::default()
    })
}

/// Builds a detector that is located on the same position as the signal
pub(crate) fn detector(signal: &Signal) -> Detector {
    Detector {
        id: signal.id.clone(),
        track: signal.track.clone(),
        position: signal.position,
        extensions: Default::default(),
    }
}

pub(crate) fn electrifications(edge: &Edge) -> Option<Electrification> {
    // TODO: handle multiple overlapping electrifications
    // Specific infrastructures can support multiple electrifications (e.g. "voltage"="600;1500;3000;15000;25000").
    // Short term solution : pick the first one, i.g. "600;1500;3000;15000;25000" -> "600V"
    edge.tags.get("voltage").and_then(|voltage| {
        voltage
            .split(';')
            .next()
            .map(|v| {
                if v.parse::<f64>().is_ok() {
                    format!("{v}V")
                } else {
                    v.to_string()
                }
            })
            .map(|parsed_voltage| Electrification {
                id: edge.id.clone().into(),
                voltage: parsed_voltage.into(),
                track_ranges: vec![ApplicableDirectionsTrackRange::new(
                    edge.id.clone(),
                    0.,
                    edge.length(),
                    ApplicableDirections::Both,
                )],
            })
    })
}

pub(crate) fn track_sections(edges: &[Edge]) -> Vec<TrackSection> {
    edges
        .iter()
        .map(|e| {
            let geo = geos::geojson::Geometry::new(geos::geojson::Value::LineString(
                e.geometry.iter().map(|c| vec![c.x, c.y]).collect(),
            ));
            TrackSection {
                id: e.id.as_str().into(),
                length: e.length(),
                geo: geo.clone(),
                extensions: TrackSectionExtensions {
                    sncf: Some(TrackSectionSncfExtension {
                        line_code: 0,
                        line_name: e
                            .tags
                            .get("name")
                            .map(NonBlankString::from)
                            .unwrap_or(NonBlankString::from("??")),
                        track_name: e
                            .tags
                            .get("railway:track_ref")
                            .map(NonBlankString::from)
                            .unwrap_or(NonBlankString::from("??")),
                        track_number: 0,
                    }),
                    source: Some(TrackSectionSourceExtension {
                        name: "OpenStreetMap".into(),
                        id: "osm".into(),
                    }),
                },
                ..Default::default()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use super::*;

    #[rstest]
    #[case("15000", "15000V")]
    #[case("15000V", "15000V")]
    #[case("600;1500;3000;15000;25000", "600V")]
    fn test_voltage(#[case] input: &str, #[case] expected: &str) {
        let edge = Edge {
            id: "1".into(),
            tags: [("voltage".to_string(), input.to_string())]
                .into_iter()
                .collect(),
            ..Default::default()
        };

        let electrification = electrifications(&edge).unwrap();

        assert_eq!(electrification.voltage, expected.into());
    }

    #[test]
    fn test_no_voltage() {
        let edge = Edge {
            id: "1".into(),
            ..Default::default()
        };

        let electrification = electrifications(&edge);

        assert!(electrification.is_none());
    }
}
