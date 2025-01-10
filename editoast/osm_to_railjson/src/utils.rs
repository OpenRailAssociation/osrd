use editoast_schemas::infra::ApplicableDirections;
use editoast_schemas::infra::ApplicableDirectionsTrackRange;
use editoast_schemas::infra::BufferStop;
use editoast_schemas::infra::Detector;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::Electrification;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::LogicalSignal;
use editoast_schemas::infra::OperationalPoint;
use editoast_schemas::infra::OperationalPointExtensions;
use editoast_schemas::infra::OperationalPointIdentifierExtension;
use editoast_schemas::infra::OperationalPointPart;
use editoast_schemas::infra::Side;
use editoast_schemas::infra::Signal;
use editoast_schemas::infra::SignalExtensions;
use editoast_schemas::infra::SignalSncfExtension;
use editoast_schemas::infra::Speed;
use editoast_schemas::infra::SpeedSection;
use editoast_schemas::infra::Switch;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::Identifier;
use geo_types::Coord;
use osm4routing::Distance;
use osm4routing::Edge;
use osm4routing::NodeId;
use osmpbfreader::Node;
use std::collections::HashMap;
use std::str::FromStr;
use tracing::error;
use tracing::warn;

// Given an edge and a coordinate, returns the coordinates used to compute the angle
// It uses the nearest OpenStreetMap node, and the other as the the rails might do a loop
// that would result in a bad angle
// However, sometimes nodes can be stacked at the same coordinates (e.g. to have different signals at the end of the way)
// That is why look for the first node that is at least 1m away from the edge start
fn reference_coord(n: NodeId, edge: &Edge) -> Coord {
    if edge.nodes[0] == n {
        let start = edge.geometry[0];
        *edge
            .geometry
            .iter()
            .find(|coord| coord.distance_to(start) > 10.0)
            .unwrap_or(&edge.geometry[edge.geometry.len() - 1])
    } else {
        let start = edge.geometry[edge.geometry.len() - 1];
        *edge
            .geometry
            .iter()
            .rev()
            .find(|coord| coord.distance_to(start) > 10.0)
            .unwrap_or(&edge.geometry[0])
    }
}

// In order for a train to be able to go from one edge to another
// The angle must be as flat as possible (180°)
fn flat(angle: f64) -> bool {
    (180.0 - angle).abs() <= 30.0
}

/// A branch it a pair of two edges that share a node
/// and whose angle is flat enough for a train to go from one edge to an other
type Branch = (TrackEndpoint, TrackEndpoint);

/// Tries to convert two edges into a branch
/// Will return None if the angle between the two edges isn’t right
pub fn try_into_branch(center: osm4routing::NodeId, e1: &Edge, e2: &Edge) -> Option<Branch> {
    let center_coord = if e1.source == center {
        e1.geometry[0]
    } else {
        e1.geometry[e1.geometry.len() - 1]
    };

    if flat(angle(
        center_coord,
        reference_coord(center, e1),
        reference_coord(center, e2),
    )) {
        Some((track_section(center, e1), track_section(center, e2)))
    } else {
        None
    }
}

fn track_section(n: NodeId, edge: &Edge) -> TrackEndpoint {
    let endpoint = if n == edge.source {
        Endpoint::Begin
    } else {
        Endpoint::End
    };

    TrackEndpoint::new(edge.id.clone(), endpoint)
}

// When building the network topology, most things happen around a Node (in the OpenStreetMap sense)
// That’s where buffer stops, and switches happen
// To do that, we count how many edges are adjacent to that node and how many branches go through that node
#[derive(Default)]
pub struct NodeAdjacencies<'a> {
    pub edges: Vec<&'a Edge>,
    pub branches: Vec<Branch>,
}

pub fn link_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut ports = HashMap::new();
    ports.insert("A".into(), branches[0].0.clone());
    ports.insert("B".into(), branches[0].1.clone());
    Switch {
        id: node.0.to_string().into(),
        switch_type: "link".into(),
        ports,
        group_change_delay: 0.,
        ..Default::default()
    }
}

pub fn point_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut endpoint_count = HashMap::<&TrackEndpoint, u64>::new();
    for (src, dst) in branches {
        *endpoint_count.entry(src).or_default() += 1;
        *endpoint_count.entry(dst).or_default() += 1;
    }

    let mut sorted_endpoint: Vec<(&TrackEndpoint, u64)> = endpoint_count.into_iter().collect();
    sorted_endpoint.sort_by(|(_, count_a), (_, count_b)| count_b.cmp(count_a));
    let mut ports = HashMap::new();
    ports.insert("A".into(), sorted_endpoint[0].0.clone());
    ports.insert("B1".into(), sorted_endpoint[1].0.clone());
    ports.insert("B2".into(), sorted_endpoint[2].0.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "point_switch".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

pub fn cross_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut ports = HashMap::new();
    ports.insert("A1".into(), branches[0].0.clone());
    ports.insert("B1".into(), branches[0].1.clone());
    ports.insert("B2".into(), branches[1].0.clone());
    ports.insert("A2".into(), branches[1].1.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "crossing".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

fn different_branches(a: &Branch, b: &Branch) -> bool {
    a.0 != b.0 && a.0 != b.1 && a.1 != b.0 && a.1 != b.1
}

pub fn double_slip_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let (north1, south1) = &branches[0];
    let (north2, south2) = branches
        .iter()
        .find(|t| different_branches(t, &branches[0]))
        .expect("Double slips must have two different branches");

    let mut ports = HashMap::new();
    ports.insert("A1".into(), north1.clone());
    ports.insert("B1".into(), south1.clone());
    ports.insert("A2".into(), north2.clone());
    ports.insert("B2".into(), south2.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "double_slip_switch".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

// Computes the angle betwen the segments [oa] and [ob]
pub fn angle(o: Coord, a: Coord, b: Coord) -> f64 {
    ((a.y - o.y).atan2(a.x - o.x).to_degrees() - (b.y - o.y).atan2(b.x - o.x).to_degrees()).abs()
}

fn direction(node: &osmpbfreader::Node) -> Direction {
    let direction_tag = node
        .tags
        .get("railway:signal:direction")
        .map(|tag| tag.as_str())
        .unwrap_or("forward");
    if direction_tag == "forward" || direction_tag == "both" {
        Direction::StartToStop
    } else {
        Direction::StopToStart
    }
}

fn main_signal(node: &osmpbfreader::OsmObj) -> bool {
    node.tags().contains_key("railway:signal:main")
        || node.tags().contains_key("railway:signal:combined")
}

/// When reading OpenStreetMap data, we sometimes need to match a Node to a Track and position
/// This struct maps the nodes to the Edges (a Way from OpenStreetMap that might have been split)
pub struct NodeToTrack<'a> {
    nodes_edges: HashMap<NodeId, Vec<&'a Edge>>,
}

impl<'a> NodeToTrack<'a> {
    pub fn from_edges(edges: &'a Vec<Edge>) -> Self {
        let mut nodes_edges = HashMap::<NodeId, Vec<&Edge>>::new();
        for edge in edges {
            for node in &edge.nodes {
                nodes_edges.entry(*node).or_default().push(edge);
            }
        }
        Self { nodes_edges }
    }

    /// Given an OSM node, returns the track and the position it is on
    /// If there is an ambiguity (the node is at intersection), we just pick one
    /// We log weird situations (the are 3 edges for that node)
    pub fn track_and_position(&self, id: NodeId) -> Option<(Identifier, f64)> {
        self.nodes_edges.get(&id).and_then(|edges| {
            if edges.is_empty() {
                error!("Missing edge for node {}", id.0);
                return None;
            } else if edges.len() >= 3 {
                warn!("Too many edges for node {}", id.0);
            }
            Some((edges[0].id.clone().into(), edges[0].length_until(&id)))
        })
    }
}

pub fn signals(
    osm_pbf_in: &std::path::PathBuf,
    nodes_to_tracks: &NodeToTrack,
    adjacencies: &HashMap<osm4routing::NodeId, NodeAdjacencies>,
) -> Vec<Signal> {
    let file = std::fs::File::open(osm_pbf_in).unwrap();
    let mut pbf = osmpbfreader::OsmPbfReader::new(file);
    pbf.iter()
        .flatten()
        .filter(main_signal)
        .flat_map(|obj| match obj {
            osmpbfreader::OsmObj::Node(node) => Some(node),
            _ => None,
        })
        .filter(|node| adjacencies.get(&node.id).map_or(0, |adj| adj.edges.len()) != 1) // Ignore all the nodes that are at the end of a track, as it will be buffer stops
        .flat_map(|node| {
            if let Some((track, position)) = nodes_to_tracks.track_and_position(node.id) {
                let mut settings = HashMap::new();
                settings.insert("Nf".into(), "true".into());

                let mut default_parameters = HashMap::new();
                default_parameters.insert("jaune_cli".into(), "false".into());

                Some(Signal {
                    id: node.id.0.to_string().into(),
                    direction: direction(&node),
                    track,
                    position,
                    sight_distance: 400.,
                    logical_signals: vec![LogicalSignal {
                        signaling_system: "BAL".to_string(),
                        settings,
                        default_parameters,
                        ..Default::default()
                    }],
                    extensions: SignalExtensions {
                        sncf: Some(sncf_extensions(&node)),
                    },
                })
            } else {
                None
            }
        })
        .collect()
}

pub fn speed_sections(edge: &Edge) -> Vec<SpeedSection> {
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

fn sncf_extensions(node: &Node) -> SignalSncfExtension {
    let label = node
        .tags
        .get("ref")
        .map(|r| r.as_str())
        .unwrap_or_default()
        .into();
    let side = node
        .tags
        .get("railway:signal:position")
        .map(|s| {
            if s == "left" {
                Side::Left
            } else if s == "right" {
                Side::Right
            } else {
                Side::Center
            }
        })
        .unwrap_or_default();
    SignalSncfExtension {
        label,
        side,
        ..Default::default()
    }
}

/// Builds a detector that is located on the same position as the signal
pub fn detector(signal: &Signal) -> Detector {
    Detector {
        id: signal.id.clone(),
        track: signal.track.clone(),
        position: signal.position,
        extensions: Default::default(),
    }
}

pub fn edge_to_buffer(node: &NodeId, edge: &Edge, count: i64) -> BufferStop {
    BufferStop {
        id: format!("buffer-{}-{count}", node.0).into(),
        track: edge.id.clone().into(),
        position: if &edge.source == node {
            0.
        } else {
            edge.length()
        },
        extensions: Default::default(),
    }
}

pub fn electrifications(edge: &Edge) -> Option<Electrification> {
    // TODO: handle multiple overlapping electrifications
    // Specific infrastructures can support multiple electrifications (e.g. "voltage"="600;1500;3000;15000;25000").
    // Short term solution : pick the first one, i.g. "600;1500;3000;15000;25000" -> "600V"
    edge.tags.get("voltage").and_then(|voltage| {
        voltage
            .split(';')
            .next()
            .map(|v| {
                if v.parse::<f64>().is_ok() {
                    format!("{}V", v)
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

pub fn operational_points(
    osm_pbf_in: &std::path::PathBuf,
    nodes_to_tracks: &NodeToTrack,
) -> Vec<OperationalPoint> {
    let file = std::fs::File::open(osm_pbf_in).unwrap();
    let mut pbf = osmpbfreader::OsmPbfReader::new(file);
    pbf.iter()
        .flatten()
        .filter(|obj| obj.tags().contains("public_transport", "stop_area")) // https://wiki.openstreetmap.org/wiki/Tag:public_transport%3Dstop_area
        .flat_map(|obj| match obj {
            osmpbfreader::OsmObj::Relation(rel) => Some(rel), // Only consider OSM relations
            _ => None,                                        // Discard Nodes and Ways
        })
        .flat_map(|rel| {
            let parts: Vec<_> = rel
                .refs
                .iter()
                .filter(|r| r.role == "stop") // We ignore other members of the relation
                .flat_map(|r| match r.member {
                    osmpbfreader::OsmId::Node(id) => Some(id),
                    _ => {
                        warn!("OpenStreetMap relation ({}) has a member ({:?}) with role `stop` that isn’t a node", rel.id.0, r.member);
                        None
                    },
                })
                .flat_map(|node| {
                    nodes_to_tracks
                        .track_and_position(node)
                        .map(|(track, position)| OperationalPointPart { track, position, extensions: Default::default() })
                })
                .collect();
            // Parts can be empty when the stop_area references stops that are not railway (e.g. bus station)
            if parts.is_empty() {
                None
            } else {
                Some(OperationalPoint {
                    id: rel.id.0.to_string().into(),
                    parts,
                    extensions: OperationalPointExtensions {
                        identifier: identifier(&rel.tags),
                        sncf: None,
                    },
                    weight: None,
                    is_station: true,
                })
            }
        })
        .collect()
}

fn identifier(tags: &osmpbfreader::Tags) -> Option<OperationalPointIdentifierExtension> {
    let uic = tags
        .get("uic_ref")
        .and_then(|uic| match i64::from_str(uic.as_str()) {
            Ok(uic) => Some(uic),
            Err(_) => {
                warn!("Could not parse {uic} uic code as integer");
                None
            }
        })
        .unwrap_or_default();

    tags.get("name")
        .map(|name| OperationalPointIdentifierExtension {
            name: name.as_str().into(),
            uic,
        })
}

#[cfg(test)]
mod tests {
    use geo_types::Coord;
    use rstest::rstest;

    use super::*;

    #[test]
    fn test_angle() {
        /* b
        .  | 90 °
        .  o–––––a */
        let o = Coord { x: 0.0, y: 0.0 };
        let a = Coord { x: 1.0, y: 0.0 };
        let b = Coord { x: 0.0, y: 1.0 };
        assert_eq!(90.0, angle(o, a, b).round());
    }

    #[test]
    fn test_flat() {
        assert!(flat(190.0));
        assert!(flat(170.0));
        assert!(!flat(10.0));
        assert!(!flat(350.0));
        assert!(!flat(90.0));
    }

    #[test]
    fn test_reference_coord() {
        let edge = Edge {
            nodes: vec![NodeId(0), NodeId(1)],
            geometry: vec![Coord { x: 0., y: 0. }, Coord { x: 1., y: 1. }],
            ..Default::default()
        };
        assert_eq!(1., reference_coord(NodeId(0), &edge).x);
        assert_eq!(0., reference_coord(NodeId(1), &edge).x);
    }

    #[test]
    fn test_reference_coord_overlapping_nodes() {
        let edge = Edge {
            nodes: vec![NodeId(0), NodeId(1), NodeId(2)],
            geometry: vec![
                Coord { x: 0., y: 0. },
                Coord { x: 0., y: 0. },
                Coord { x: 1., y: 1. },
            ],
            ..Default::default()
        };
        assert_eq!(1., reference_coord(NodeId(0), &edge).x);
        assert_eq!(0., reference_coord(NodeId(2), &edge).x);
    }

    #[rstest]
    #[case("15000", "15000V")]
    #[case("15000V", "15000V")]
    #[case("600;1500;3000;15000;25000", "600V")]
    fn test_voltage(#[case] input: &str, #[case] expected: &str) {
        let edge = Edge {
            id: "1".into(),
            tags: HashMap::from([("voltage".into(), input.into())]),
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
