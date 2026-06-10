use geo_types::Coord;
use osm4routing::Distance;
use osm4routing::Edge;
use osm4routing::NodeId;
use schemas::infra::Endpoint;
use schemas::infra::TrackEndpoint;
use std::collections::HashMap;

/// A branch is a pair of two edges that share a node
/// and whose angle is flat enough for a train to go from one edge to another
pub type Branch = (TrackEndpoint, TrackEndpoint);

/// When building the network topology, most things happen around a Node (in the OpenStreetMap sense)
/// That’s where buffer stops, and switches happen
/// To do that, we count how many edges are adjacent to that node and how many branches go through that node
#[derive(Default)]
pub(crate) struct NodeAdjacencies<'a> {
    pub edges: Vec<&'a Edge>,
    pub branches: Vec<Branch>,
}

pub fn build_adjacencies<'a>(
    edges: &'a [Edge],
) -> HashMap<osm4routing::NodeId, NodeAdjacencies<'a>> {
    let mut adjacencies = HashMap::<osm4routing::NodeId, NodeAdjacencies>::new();
    for edge in edges {
        adjacencies.entry(edge.source).or_default().edges.push(edge);
        adjacencies.entry(edge.target).or_default().edges.push(edge);
    }
    for (node, adj) in &mut adjacencies {
        for e1 in &adj.edges {
            for e2 in &adj.edges {
                if e1.id < e2.id
                    && let Some(branch) = try_into_branch(*node, e1, e2)
                {
                    adj.branches.push(branch);
                }
            }
        }
    }
    adjacencies
}

/// Tries to convert two edges into a branch
/// Will return None if the angle between the two edges isn’t right
fn try_into_branch(center: osm4routing::NodeId, e1: &Edge, e2: &Edge) -> Option<Branch> {
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

/// Given an edge and a coordinate, returns the coordinates used to compute the angle
/// It uses the nearest OpenStreetMap node, and the other as the rails might do a loop
/// that would result in a bad angle
/// However, sometimes nodes can be stacked at the same coordinates (e.g. to have different signals at the end of the way)
/// That is why it looks for the first node that is at least 1m away from the edge start
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

/// In order for a train to be able to go from one edge to another
/// The angle must be as flat as possible (180°)
fn flat(angle: f64) -> bool {
    (180.0 - angle).abs() <= 30.0
}

/// Computes the angle between the segments [oa] and [ob]
fn angle(o: Coord, a: Coord, b: Coord) -> f64 {
    ((a.y - o.y).atan2(a.x - o.x).to_degrees() - (b.y - o.y).atan2(b.x - o.x).to_degrees()).abs()
}

fn track_section(n: NodeId, edge: &Edge) -> TrackEndpoint {
    let endpoint = if n == edge.source {
        Endpoint::Begin
    } else {
        Endpoint::End
    };

    TrackEndpoint::new(edge.id.clone(), endpoint)
}

#[cfg(test)]
mod tests {
    use geo_types::Coord;

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
}
