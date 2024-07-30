//! In order to build all the routes, we must do a graph search.
//! This module provides this graph search and can be understood in three different parts
//! - part 1: type definitions for nodes and edges
//! - part 2: build the graph
//! - part 3: compute the routes

use std::collections::HashMap;

use editoast_schemas::infra::builtin_node_types_list;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::RailJson;
use editoast_schemas::infra::Route;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::infra::Waypoint;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::primitives::OSRDIdentified;

/* Part 1: type definitions */
// When building the graph, a node can be a trackEndPoint, a detector or a buffer stop
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
enum Node {
    TrackEndpoint(TrackEndpoint),
    Detector(Identifier),
    BufferStop(Identifier),
}

impl Node {
    fn from_track_endpoint(track: &Identifier, endpoint: Endpoint) -> Self {
        Node::TrackEndpoint(TrackEndpoint {
            track: track.clone(),
            endpoint,
        })
    }
}

/// An edge connects two nodes
/// This connection can be between two tracks (track_node)
/// Or traversing a whole track
/// Or along a track (detector and buffer stops)
#[derive(Clone, Debug)]
enum EdgeType {
    TrackNode { id: Identifier, port: Identifier },
    Track,
    Buffer(Direction),
    ToDetector,
    FromDetector(Direction),
}

/// In order to find routes, we build a graph to ease the search of successors of a Node
/// A node can be a trackendpoint (intermediary node), but also a detector or a buffer stop (start or end node of a route)
/// The graph is therefor expanded and has more Edges than the Railjson has TrackSections
#[derive(Default)]
struct Graph {
    successors: HashMap<Node, Vec<Node>>,
    edges: HashMap<(Node, Node), EdgeType>,
}

impl Graph {
    /* Part 2: build the graph from track sections, track_nodes, buffers and detectors */
    fn load(&mut self, railjson: &RailJson) {
        self.edges_from_track_sections(railjson);
        self.edges_from_track_nodes(railjson);
    }

    fn edges_from_track_sections(&mut self, railjson: &RailJson) {
        // We need to split handle separately the signals that are forward
        let mut detectors = HashMap::<_, Vec<_>>::new();

        for detector in &railjson.detectors {
            detectors
                .entry(detector.track.clone())
                .or_default()
                .push(detector.clone());
        }

        for (track, detectors) in &detectors {
            // When going from start to end
            // We only consider the last detector (closest to end) that is on the same track
            // All the other can be considered as block defining
            let detector = detectors
                .iter()
                .max_by_key(|d| (d.position * 1000.0).round() as u64)
                .expect("missing detector");

            let u = Node::from_track_endpoint(track, Endpoint::Begin);
            let d = Node::Detector(detector.id.clone());
            let v = Node::from_track_endpoint(track, Endpoint::End);
            self.add_directed_edge(u, d.clone(), EdgeType::ToDetector);
            self.add_directed_edge(d.clone(), v, EdgeType::FromDetector(Direction::StartToStop));

            // When going from end to start,
            // We only consider the first detector (closest to start) that is on the same track
            // All the other can be considered as block defining
            let detector = detectors
                .iter()
                .min_by_key(|d| (d.position * 1000.0).round() as u64) //Because floats aren’t sortable
                .expect("missing detector");
            let u = Node::from_track_endpoint(track, Endpoint::End);
            let d = Node::Detector(detector.id.clone());
            let v = Node::from_track_endpoint(track, Endpoint::Begin);
            self.add_directed_edge(u, d.clone(), EdgeType::ToDetector);
            self.add_directed_edge(d.clone(), v, EdgeType::FromDetector(Direction::StopToStart));
        }

        for buffer in &railjson.buffer_stops {
            let b = Node::BufferStop(buffer.id.clone());
            if buffer.position < 0.1 {
                let u = Node::from_track_endpoint(&buffer.track, Endpoint::Begin);
                self.add_symmetrical_edge(b, u, EdgeType::Buffer(Direction::StartToStop));
            } else {
                let u = Node::from_track_endpoint(&buffer.track, Endpoint::End);
                self.add_symmetrical_edge(b, u, EdgeType::Buffer(Direction::StopToStart));
            }
        }

        for track in &railjson.track_sections {
            // We only consider tracks that have no detector for the given direction on them as we split them
            let u = Node::from_track_endpoint(&track.id, Endpoint::Begin);
            let v = Node::from_track_endpoint(&track.id, Endpoint::End);
            if !detectors.contains_key(&track.id) {
                self.add_symmetrical_edge(v.clone(), u.clone(), EdgeType::Track);
            }
        }
    }

    fn edges_from_track_nodes(&mut self, railjson: &RailJson) {
        for track_node in &railjson.track_nodes {
            let builtin_node_types = builtin_node_types_list();
            let track_node_type = builtin_node_types
                .iter()
                .find(|t| t.id == track_node.track_node_type)
                .expect("TrackNode must have associated type");

            for (port_id, track_node_ports) in track_node_type.groups.iter() {
                for track_node_port in track_node_ports {
                    let u = Node::TrackEndpoint(
                        track_node
                            .ports
                            .get(&track_node_port.src)
                            .expect("TrackNode must have all ports set")
                            .clone(),
                    );
                    let v = Node::TrackEndpoint(
                        track_node
                            .ports
                            .get(&track_node_port.dst)
                            .expect("TrackNode must have all ports set")
                            .clone(),
                    );
                    let edge_type = EdgeType::TrackNode {
                        id: track_node.id.clone(),
                        port: port_id.clone(),
                    };
                    self.add_symmetrical_edge(u, v, edge_type);
                }
            }
        }
    }

    fn add_directed_edge(&mut self, u: Node, v: Node, edge_type: EdgeType) {
        self.edges.insert((u.clone(), v.clone()), edge_type);
        self.successors.entry(u).or_default().push(v);
    }

    fn add_symmetrical_edge(&mut self, u: Node, v: Node, edge_type: EdgeType) {
        self.add_directed_edge(u.clone(), v.clone(), edge_type.clone());
        self.add_directed_edge(v, u, edge_type);
    }

    /* Part 3: compute the different routes */

    // Computes all the routes from one Node (buffer stop or detector) to all others
    // The routes don’t go beyond a detector or a buffer stop
    fn one_to_all_routes(&self, start: Node) -> Vec<Route> {
        let mut result = vec![];
        let mut count = 0;
        let mut parent = HashMap::new();
        let mut stack = Vec::from([&start]);

        while let Some(current) = stack.pop() {
            if let Some(successors) = self.successors.get(current) {
                for succ in successors {
                    if self.valid_successor(&start, current, succ, &parent) {
                        parent.insert(succ, current);
                        match &succ {
                            // All routes end at a buffer or detector and we build it
                            Node::BufferStop(_) | Node::Detector(_) => {
                                result.push(self.build_route(count, succ, &parent));
                                count += 1;
                            }
                            Node::TrackEndpoint(_track_endpoint) => {
                                stack.push(succ);
                            }
                        }
                    }
                }
            }
        }
        result
    }

    // Can we actually use that edge in our route search
    fn valid_successor(
        &self,
        start: &Node,
        current: &Node,
        succ: &Node,
        parent: &HashMap<&Node, &Node>,
    ) -> bool {
        let edge = self
            .edges
            .get(&(current.clone(), succ.clone()))
            .expect("Edge does not exist");
        let previous_edge = parent
            .get(current)
            .and_then(|&p| self.edges.get(&(p.clone(), current.clone())));

        let track_node_u_turn = matches!(edge, EdgeType::TrackNode { .. })
            && matches!(previous_edge, Some(EdgeType::TrackNode { .. }));

        // Don’t make a U-turn on a detector
        // -o---d>--o- The detector is only in one direction
        //   \__<__/   There is a bypass in the opposite direction
        // We don’t want to reach the detector through the bypass
        let detector_u_turn = (matches!(edge, EdgeType::Track | EdgeType::ToDetector)
            && matches!(previous_edge, Some(EdgeType::FromDetector(_))))
            || (matches!(edge, EdgeType::ToDetector)
                && matches!(
                    previous_edge,
                    Some(EdgeType::Track | EdgeType::FromDetector(_))
                ));

        !parent.contains_key(&succ) // Don’t explore nodes that have already been visited
            && succ != start // Don’t pass again through the start
            && !track_node_u_turn
            && !detector_u_turn
    }

    // Once we found a route, we must build by scanning the predecessors
    fn build_route(&self, count: u64, end: &Node, pred: &HashMap<&Node, &Node>) -> Route {
        let mut track_nodes_directions = HashMap::new();

        let mut last_direction = Direction::StartToStop;
        // We go back from the end all the way to the start
        // We store every track_node we encounter on the way
        let mut current = end;
        while let Some(&pred) = pred.get(&current) {
            match self.edges.get(&(pred.clone(), current.clone())) {
                Some(EdgeType::TrackNode { id, port }) => {
                    track_nodes_directions.insert(id.clone(), port.clone());
                }
                Some(EdgeType::FromDetector(direction)) | Some(EdgeType::Buffer(direction)) => {
                    last_direction = *direction;
                }
                _ => (),
            }
            current = pred;
        }

        let (entry_point, entry_point_direction) = match current {
            Node::BufferStop(id) => (Waypoint::BufferStop { id: id.clone() }, last_direction),
            Node::Detector(id) => (Waypoint::Detector { id: id.clone() }, last_direction),
            _ => unreachable!("An entry point must be a buffer stop or a detector"),
        };

        let exit_point = match end {
            Node::BufferStop(id) => Waypoint::BufferStop { id: id.clone() },
            Node::Detector(id) => Waypoint::Detector { id: id.clone() },
            _ => unreachable!("An exit point must be a buffer stop or a detector"),
        };

        Route {
            id: format!("{}-{count}", entry_point.get_id()).into(),
            entry_point_direction,
            entry_point,
            exit_point,
            track_nodes_directions,
            release_detectors: vec![],
        }
    }
}

pub fn routes(railjson: &RailJson) -> Vec<Route> {
    let mut graph = Graph::default();
    graph.load(railjson);

    let from_buffers = railjson
        .buffer_stops
        .iter()
        .flat_map(|b| graph.one_to_all_routes(Node::BufferStop(b.id.clone())));

    let from_detectors = railjson
        .detectors
        .iter()
        .flat_map(|d| graph.one_to_all_routes(Node::Detector(d.id.clone())));

    from_buffers.chain(from_detectors).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::TrackSection;

    fn min_infra() -> RailJson {
        let track = TrackSection {
            id: "track".into(),
            length: 1.,
            ..Default::default()
        };
        let detector = Detector {
            id: "detector".into(),
            position: 0.5,
            track: "track".into(),
            ..Default::default()
        };
        let buffer_begin = BufferStop {
            id: "buffer_begin".into(),
            position: 0.,
            track: "track".into(),
            extensions: Default::default(),
        };
        let buffer_end = BufferStop {
            id: "buffer_end".into(),
            position: 1.,
            track: "track".into(),
            extensions: Default::default(),
        };

        RailJson {
            track_sections: vec![track],
            buffer_stops: vec![buffer_begin, buffer_end],
            detectors: vec![detector],
            ..Default::default()
        }
    }

    #[test]
    fn build_graph() {
        let mut g = super::Graph::default();
        g.load(&min_infra());
        let begin = super::Node::BufferStop("buffer_begin".into());
        let end = super::Node::BufferStop("buffer_end".into());
        let detector = super::Node::Detector("detector".into());
        // buffer, trackend, detector, trackend, buffer
        assert_eq!(5, g.successors.len());
        assert_eq!(1, g.successors.get(&begin).unwrap().len());
        assert_eq!(1, g.successors.get(&end).unwrap().len());
        assert_eq!(2, g.successors.get(&detector).unwrap().len());
    }

    #[test]
    fn build_route() {
        let start = Node::BufferStop("start".into());
        let t1 = Node::from_track_endpoint(&"t1".to_string().into(), Endpoint::Begin);
        let t2 = Node::from_track_endpoint(&"t2".to_string().into(), Endpoint::Begin);
        let end = Node::BufferStop("end".into());
        let mut graph = Graph::default();
        graph
            .edges
            .insert((start.clone(), t1.clone()), EdgeType::Track);
        graph.edges.insert(
            (t1.clone(), t2.clone()),
            EdgeType::TrackNode {
                id: "track_node".into(),
                port: "port".into(),
            },
        );
        graph
            .edges
            .insert((t2.clone(), end.clone()), EdgeType::Track);

        let mut pred = HashMap::new();
        pred.insert(&t1, &start);
        pred.insert(&t2, &t1);
        pred.insert(&end, &t2);

        let route = graph.build_route(0, &end, &pred);
        assert!(route.entry_point.is_buffer_stop());
        assert!(route.exit_point.is_buffer_stop());
        assert_eq!(1, route.track_nodes_directions.len());
    }

    #[test]
    /* --s-- one track, one detector, two buffers */
    fn minimal_routes() {
        let routes = super::routes(&min_infra());
        assert_eq!(4, routes.len());
    }

    #[test]
    /* ----o---d---
            \------
        The test case has one track_node and one detector
    */
    fn generate_routes() {
        let railjson =
            crate::osm_to_railjson::parse_osm("src/tests/routes.osm.pbf".into()).unwrap();
        let routes = super::routes(&railjson);
        assert_eq!(6, routes.len());
        let routes_with_track_nodes_count = routes
            .iter()
            .filter(|r| r.track_nodes_directions.len() == 1)
            .count();
        assert_eq!(4, routes_with_track_nodes_count);
    }
}
