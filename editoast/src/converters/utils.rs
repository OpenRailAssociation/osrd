use std::collections::HashMap;

use crate::schema::*;
use osm4routing::{Coord, Edge, NodeId};

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
        "default".into(),
        vec![
            SwitchPortConnection {
                src: "NORTH".into(),
                dst: "SOUTH".into(),
            },
            SwitchPortConnection {
                src: "EASTH".into(),
                dst: "WEST".into(),
            },
        ],
    );

    let mut double_cross_groups = std::collections::HashMap::new();
    double_cross_groups.insert(
        "n1-s1".into(),
        vec![SwitchPortConnection {
            src: "NORTH-1".into(),
            dst: "SOUTH-1".into(),
        }],
    );
    double_cross_groups.insert(
        "n2-s1".into(),
        vec![SwitchPortConnection {
            src: "NORTH-1".into(),
            dst: "SOUTH-2".into(),
        }],
    );
    double_cross_groups.insert(
        "n1-s2".into(),
        vec![SwitchPortConnection {
            src: "NORTH-2".into(),
            dst: "SOUTH-1".into(),
        }],
    );
    double_cross_groups.insert(
        "n2-s2".into(),
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
