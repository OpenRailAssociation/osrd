use std::collections::HashMap;

use crate::schema::*;
use log::{error, warn};
use osm4routing::{Coord, Edge, NodeId};
use osmpbfreader::Node;

pub fn default_switch_types() -> Vec<SwitchType> {
    let mut point_groups = std::collections::HashMap::new();
    point_groups.insert(
        "LEFT".into(),
        vec![SwitchPortConnection {
            src: "BASE".into(),
            dst: "LEFT".into(),
        }],
    );
    point_groups.insert(
        "RIGHT".into(),
        vec![SwitchPortConnection {
            src: "BASE".into(),
            dst: "RIGHT".into(),
        }],
    );

    let mut cross_groups = std::collections::HashMap::new();
    cross_groups.insert(
        "DEFAULT".into(),
        vec![
            SwitchPortConnection {
                src: "NORTH".into(),
                dst: "SOUTH".into(),
            },
            SwitchPortConnection {
                src: "EAST".into(),
                dst: "WEST".into(),
            },
        ],
    );

    let mut double_cross_groups = std::collections::HashMap::new();
    double_cross_groups.insert(
        "N1-S1".into(),
        vec![SwitchPortConnection {
            src: "NORTH-1".into(),
            dst: "SOUTH-1".into(),
        }],
    );
    double_cross_groups.insert(
        "N2-S1".into(),
        vec![SwitchPortConnection {
            src: "NORTH-1".into(),
            dst: "SOUTH-2".into(),
        }],
    );
    double_cross_groups.insert(
        "N1-S2".into(),
        vec![SwitchPortConnection {
            src: "NORTH-2".into(),
            dst: "SOUTH-1".into(),
        }],
    );
    double_cross_groups.insert(
        "N2-S2".into(),
        vec![SwitchPortConnection {
            src: "NORTH-2".into(),
            dst: "SOUTH-2".into(),
        }],
    );

    vec![
        SwitchType {
            id: "point".into(),
            ports: vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            groups: point_groups,
        },
        SwitchType {
            id: "cross_over".into(),
            ports: vec!["NORTH".into(), "SOUTH".into(), "EAST".into(), "WEST".into()],
            groups: cross_groups,
        },
        SwitchType {
            id: "double_slip".into(),
            ports: vec![
                "SOUTH-1".into(),
                "SOUTH-2".into(),
                "NORTH-1".into(),
                "NORTH-2".into(),
            ],
            groups: double_cross_groups,
        },
    ]
}

// Given an edge and a coordinate, returns the coordinates used to compute the angle
// It uses the nearest OpenStreetMap node, and the other as the the rails might do a loop
// that would result in a bad angle
fn reference_coord(n: NodeId, edge: &Edge) -> Coord {
    if edge.source == n {
        edge.geometry[1]
    } else {
        edge.geometry[edge.geometry.len() - 2]
    }
}

// In order for a train to be able to go from one edge to another
// The angle must be as flat as possible (180°)
fn flat(angle: f64) -> bool {
    (180.0 - angle).abs() <= 30.0
}

/// A brnanch it a pair of two edges that share a node
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
// That’s where buffer stops, section links and switches happen
// To do that, we count how many edges are adjacent to that node and how many branches go through that node
#[derive(Default)]
pub struct NodeAdjacencies<'a> {
    pub edges: Vec<&'a Edge>,
    pub branches: Vec<Branch>,
}

pub fn point_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut endpoint_count = HashMap::<&TrackEndpoint, u64>::new();
    for (src, dst) in branches {
        *endpoint_count.entry(src).or_default() += 1;
        *endpoint_count.entry(dst).or_default() += 1;
    }

    let mut sorted_endpoint: Vec<(&TrackEndpoint, u64)> = endpoint_count.into_iter().collect();
    sorted_endpoint.sort_by(|(_, count_a), (_, count_b)| count_a.cmp(count_b));
    let mut ports = HashMap::new();
    ports.insert("BASE".into(), sorted_endpoint[0].0.clone());
    ports.insert("LEFT".into(), sorted_endpoint[1].0.clone());
    ports.insert("RIGHT".into(), sorted_endpoint[2].0.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "point".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

pub fn cross_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut ports = HashMap::new();
    ports.insert("NORTH".into(), branches[0].0.clone());
    ports.insert("SOUTH".into(), branches[0].1.clone());
    ports.insert("EAST".into(), branches[1].0.clone());
    ports.insert("WEST".into(), branches[1].1.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "cross_over".into(),
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
    ports.insert("NORTH-1".into(), north1.clone());
    ports.insert("SOUTH-1".into(), south1.clone());
    ports.insert("NORTH-2".into(), north2.clone());
    ports.insert("SOUTH-2".into(), south2.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "double_slip".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

// Computes the angle betwen the segments [oa] and [ob]
pub fn angle(o: Coord, a: Coord, b: Coord) -> f64 {
    ((a.lat - o.lat).atan2(a.lon - o.lon).to_degrees()
        - (b.lat - o.lat).atan2(b.lon - o.lon).to_degrees())
    .abs()
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

pub fn signals(osm_pbf_in: std::path::PathBuf, edges: &Vec<Edge>) -> Vec<Signal> {
    let mut nodes_edges = HashMap::<NodeId, Vec<&Edge>>::new();
    for edge in edges {
        for node in &edge.nodes {
            nodes_edges.entry(*node).or_default().push(edge);
        }
    }

    let file = std::fs::File::open(osm_pbf_in).unwrap();
    let mut pbf = osmpbfreader::OsmPbfReader::new(file);
    pbf.iter()
        .flatten()
        .filter(main_signal)
        .flat_map(|obj| {
            if let osmpbfreader::OsmObj::Node(node) = obj {
                if let Some(current_edges) = nodes_edges.get(&node.id) {
                    if current_edges.is_empty() {
                        error!("Missing edge for node {}", node.id.0);
                        return None;
                    } else if current_edges.len() >= 3 {
                        warn!("Too many edges for node {}", node.id.0);
                    }

                    let mut settings = HashMap::new();
                    settings.insert("Nf".into(), "true".into());

                    Some(Signal {
                        id: node.id.0.to_string().into(),
                        direction: direction(&node),
                        track: current_edges[0].id.clone().into(),
                        position: current_edges[0].length_until(&node.id),
                        sight_distance: 400.,
                        logical_signals: Some(vec![LogicalSignal {
                            signaling_system: "BAL".to_string(),
                            settings,
                            ..Default::default()
                        }]),
                        linked_detector: Some(node.id.0.to_string()),
                        extensions: SignalExtensions {
                            sncf: Some(sncf_extensions(&node)),
                        },
                    })
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect()
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
        aspects: vec![
            "Carré".to_string(),
            "Feu Rouge Clignotant".to_string(),
            "Sémaphore".to_string(),
            "Avertissement".to_string(),
            "Feu Vert".to_string(),
        ],
        default_aspect: "CARRE".to_string(),
        installation_type: "CARRE".to_string(),
        is_in_service: true,
        is_lightable: true,
        is_operational: true,
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
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use osm4routing::Coord;

    use crate::converters::utils::*;

    #[test]
    fn test_angle() {
        /* b
        .  | 90 °
        .  o–––––a */
        let o = Coord { lon: 0.0, lat: 0.0 };
        let a = Coord { lon: 1.0, lat: 0.0 };
        let b = Coord { lon: 0.0, lat: 1.0 };
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
}
