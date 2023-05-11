use std::collections::HashMap;

use crate::schema::*;
use osm4routing::{models::Coord, models::Edge, NodeId};

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
            id: "cross_ever".into(),
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

pub enum EdgeAngleError {
    InvalidAngle(NodeId),
}

fn build_track_endpoint((edge, endpoint): (&Edge, Endpoint)) -> TrackEndpoint {
    TrackEndpoint {
        track: edge.id.as_str().into(),
        endpoint,
    }
}

pub fn build_track_section_link(
    edge_a: (&Edge, Endpoint),
    edge_b: (&Edge, Endpoint),
) -> TrackSectionLink {
    let id = if edge_a.1 == Endpoint::Begin {
        edge_a.0.source
    } else {
        edge_a.0.target
    };
    let src = build_track_endpoint(edge_a);
    let dst = build_track_endpoint(edge_b);
    TrackSectionLink {
        id: id.0.to_string().into(),
        src,
        dst,
    }
}

/// Given an edge and it’s enpoint, returns the coordinates used to compute the angle
/// It uses the nearest OpenStreetMap node, and the other as the the rails might do a loop
/// that would result in a bad angle
fn reference_coord((edge, endpoint): (&Edge, Endpoint)) -> Coord {
    if endpoint == Endpoint::Begin {
        edge.geometry[1]
    } else {
        edge.geometry[edge.geometry.len() - 2]
    }
}

/// In order for a train to be able to go from one edge to another
/// The angle must be as flat as possible (180°)
fn flat(angle: f64) -> bool {
    (180.0 - angle).abs() <= 30.0
}

pub fn build_point_switch(
    (node, edges): (&NodeId, &Vec<(&Edge, Endpoint)>),
) -> Result<Switch, EdgeAngleError> {
    let center = if edges[0].1 == Endpoint::Begin {
        edges[0].0.geometry[0]
    } else {
        edges[0].0.geometry[edges[0].0.geometry.len() - 1]
    };
    let a = reference_coord(edges[0]);
    let b = reference_coord(edges[1]);
    let c = reference_coord(edges[2]);

    let ab = angle(center, a, b);
    let ac = angle(center, a, c);
    let bc = angle(center, b, c);

    let track_endpoint_a = build_track_endpoint(edges[0]);
    let track_endpoint_b = build_track_endpoint(edges[1]);
    let track_endpoint_c = build_track_endpoint(edges[1]);

    let (base, left, right) = match (flat(ab), flat(ac), flat(bc)) {
        (true, true, false) => Ok((track_endpoint_a, track_endpoint_b, track_endpoint_c)),
        (true, false, true) => Ok((track_endpoint_b, track_endpoint_a, track_endpoint_c)),
        (false, true, true) => Ok((track_endpoint_c, track_endpoint_a, track_endpoint_b)),
        _ => {
            eprintln!("point switch {} impossible angles {ab}, {ac}, {bc}", node.0);
            Err(EdgeAngleError::InvalidAngle(*node))
        }
    }?;

    let mut ports = HashMap::new();
    ports.insert("BASE".into(), base);
    ports.insert("LEFT".into(), left);
    ports.insert("RIGHT".into(), right);

    Ok(Switch {
        id: node.0.to_string().into(),
        switch_type: "point".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    })
}

// Computes the angle betwen the segments [oa] and [ob]
fn angle(o: Coord, a: Coord, b: Coord) -> f64 {
    ((a.lat - o.lat).atan2(a.lon - o.lon).to_degrees()
        - (b.lat - o.lat).atan2(b.lon - o.lon).to_degrees())
    .abs()
}

#[cfg(test)]
mod tests {
    use osm4routing::models::Coord;

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
