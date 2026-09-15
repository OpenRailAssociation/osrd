//! In order to build all the routes, we must do a graph search.
//! This module provides this graph search and can be understood in three different parts
//! - part 1: type definitions for nodes and edges
//! - part 2: build the graph
//! - part 3: compute the routes

use itertools::Itertools;
use schemas::infra::BufferStop;
use schemas::infra::Detector;
use schemas::infra::Direction;
use schemas::infra::Endpoint;
use schemas::infra::Route;
use schemas::infra::Switch;
use schemas::infra::TrackEndpoint;
use schemas::infra::TrackSection;
use schemas::infra::Waypoint;
use schemas::infra::builtin_node_types_list;
use schemas::primitives::Identifier;
use schemas::primitives::OSRDIdentified;
use std::collections::HashMap;

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
/// This connection can be between two tracks (switch)
/// Or traversing a whole track
/// Or along a track (detector and buffer stops)
#[derive(Clone, Debug)]
enum EdgeType {
    Switch { id: Identifier, port: Identifier },
    Track,
    Buffer(Direction),
    ToDetector,
    FromDetector(Direction),
}

/// In order to find routes, we build a graph to ease the search of successors of a Node
/// A node can be a trackendpoint (intermediary node), but also a detector or a buffer stop (start or end node of a route)
/// The graph is therefore expanded and has more Edges than the Railjson has TrackSections
#[derive(Default)]
struct Graph {
    successors: HashMap<Node, Vec<Node>>,
    edges: HashMap<(Node, Node), EdgeType>,
    length: HashMap<(Node, Node), f64>,
}

impl Graph {
    /* Part 2: build the graph from track sections, switches, buffers and detectors */
    fn load(
        &mut self,
        track_sections: &[TrackSection],
        detectors: &[Detector],
        buffer_stops: &[BufferStop],
        switches: &[Switch],
    ) {
        self.edges_from_track_sections(track_sections, detectors, buffer_stops);
        self.edges_from_switches(switches);
    }

    fn edges_from_track_sections(
        &mut self,
        track_sections: &[TrackSection],
        detectors: &[Detector],
        buffer_stops: &[BufferStop],
    ) {
        // We need to split handle separately the signals that are forward
        let detectors_by_track = detectors
            .iter()
            .map(|detector| (&detector.track, detector))
            .into_group_map();

        let track_length: HashMap<_, _> = track_sections
            .iter()
            .map(|track| (track.id.clone(), track.length))
            .collect();

        for (track, detectors) in &detectors_by_track {
            let u = Node::from_track_endpoint(track, Endpoint::Begin);
            let v = Node::from_track_endpoint(track, Endpoint::End);
            let length = *track_length
                .get(*track)
                .expect("A track must have a length");

            // When going from start to end
            // We only consider the last detector (closest to end) that is on the same track
            // All the other can be considered as block defining
            let detector = detectors
                .iter()
                .max_by_key(|d| (d.position * 1000.0).round() as u64)
                .expect("missing detector");
            let d = Node::Detector(detector.id.clone());
            self.add_directed_edge(
                u.clone(),
                d.clone(),
                EdgeType::ToDetector,
                detector.position,
            );
            self.add_directed_edge(
                d.clone(),
                v.clone(),
                EdgeType::FromDetector(Direction::StartToStop),
                length - detector.position,
            );

            // When going from end to start
            // We only consider the first detector (closest to start) that is on the same track
            // All the other can be considered as block defining
            let detector = detectors
                .iter()
                .min_by_key(|d| (d.position * 1000.0).round() as u64) //Because floats aren’t sortable
                .expect("missing detector");
            let d = Node::Detector(detector.id.clone());
            self.add_directed_edge(
                v.clone(),
                d.clone(),
                EdgeType::ToDetector,
                length - detector.position,
            );
            self.add_directed_edge(
                d.clone(),
                u.clone(),
                EdgeType::FromDetector(Direction::StopToStart),
                detector.position,
            );
        }

        for buffer in buffer_stops {
            let b = Node::BufferStop(buffer.id.clone());
            if buffer.position < 0.1 {
                let u = Node::from_track_endpoint(&buffer.track, Endpoint::Begin);
                self.add_symmetrical_edge(b, u, EdgeType::Buffer(Direction::StartToStop), 0.0);
            } else {
                let u = Node::from_track_endpoint(&buffer.track, Endpoint::End);
                self.add_symmetrical_edge(b, u, EdgeType::Buffer(Direction::StopToStart), 0.0);
            }
        }

        for track in track_sections {
            // We only consider tracks that have no detector for the given direction on them as we split them
            let u = Node::from_track_endpoint(&track.id, Endpoint::Begin);
            let v = Node::from_track_endpoint(&track.id, Endpoint::End);
            if !detectors_by_track.contains_key(&track.id) {
                self.add_symmetrical_edge(v.clone(), u.clone(), EdgeType::Track, track.length);
            }
        }
    }

    fn edges_from_switches(&mut self, switches: &[Switch]) {
        for switch in switches {
            let builtin_node_types = builtin_node_types_list();
            let switch_type = builtin_node_types
                .iter()
                .find(|t| t.id == switch.switch_type)
                .expect("Switch must have associated type");

            for (port_id, switch_ports) in switch_type.groups.iter() {
                for switch_port in switch_ports {
                    let u = Node::TrackEndpoint(
                        switch
                            .ports
                            .get(&switch_port.src)
                            .expect("Switch must have all ports set")
                            .clone(),
                    );
                    let v = Node::TrackEndpoint(
                        switch
                            .ports
                            .get(&switch_port.dst)
                            .expect("Switch must have all ports set")
                            .clone(),
                    );
                    let edge_type = EdgeType::Switch {
                        id: switch.id.clone(),
                        port: port_id.clone(),
                    };
                    self.add_symmetrical_edge(u, v, edge_type, 0.0);
                }
            }
        }
    }

    fn add_directed_edge(&mut self, u: Node, v: Node, edge_type: EdgeType, length: f64) {
        self.edges.insert((u.clone(), v.clone()), edge_type);
        self.length.insert((u.clone(), v.clone()), length);
        self.successors.entry(u).or_default().push(v);
    }

    fn add_symmetrical_edge(&mut self, u: Node, v: Node, edge_type: EdgeType, length: f64) {
        self.add_directed_edge(u.clone(), v.clone(), edge_type.clone(), length);
        self.add_directed_edge(v, u, edge_type, length);
    }

    /* Part 3: compute the different routes */

    // Returns the length of the edge
    fn get_length(&self, (u, v): (Node, Node)) -> f64 {
        *self
            .length
            .get(&(u, v))
            .expect("Length of edge is undefined")
    }

    // Computes all the routes from one Node (buffer stop or detector) to all others
    // The routes don’t go beyond a detector or a buffer stop
    fn one_to_all_routes(&self, start: Node, max_route_length: Option<f64>) -> Vec<Route> {
        let mut result = vec![];
        let mut count = 0;
        let mut parent = HashMap::new();
        let mut stack = Vec::from([&start]);
        let mut distance = HashMap::new();
        distance.insert(&start, 0.0);

        while let Some(current) = stack.pop() {
            let current_total_length = *distance
                .get(current)
                .expect("A node that has been reached must have a distance");
            if let Some(successors) = self.successors.get(current) {
                for succ in successors {
                    // Get the distance of the current and next node from start
                    let added_length = self.get_length((current.clone(), succ.clone()));
                    let new_total_length = current_total_length + added_length;
                    if max_route_length
                        .map(|max_route_length| new_total_length <= max_route_length)
                        .unwrap_or(true)
                    {
                        // Checks whether the successor is valid and add it to the stack
                        if self.valid_successor(&start, current, succ, &parent) {
                            // Add the successor distance computed from the current distance to the hashmap
                            distance.insert(succ, new_total_length);
                            parent.insert(succ, current);
                            match &succ {
                                // All routes end at a buffer or detector and we build it
                                Node::BufferStop(_) | Node::Detector(_) => {
                                    count += 1;
                                    result.push(self.build_route(count, succ, &parent));
                                }
                                Node::TrackEndpoint(_track_endpoint) => {
                                    stack.push(succ);
                                }
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

        let switch_u_turn = matches!(edge, EdgeType::Switch { .. })
            && matches!(previous_edge, Some(EdgeType::Switch { .. }));

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
            && !switch_u_turn
            && !detector_u_turn
    }

    // Once we found a route, we must build by scanning the predecessors
    fn build_route(&self, count: u64, end: &Node, pred: &HashMap<&Node, &Node>) -> Route {
        let mut switches_directions = HashMap::new();

        let mut last_direction = Direction::StartToStop;
        // We go back from the end all the way to the start
        // We store every switch we encounter on the way
        let mut current = end;
        while let Some(&pred) = pred.get(&current) {
            match self.edges.get(&(pred.clone(), current.clone())) {
                Some(EdgeType::Switch { id, port }) => {
                    switches_directions.insert(id.clone(), port.clone());
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
            switches_directions,
            release_detectors: vec![],
        }
    }
}

pub fn routes(
    track_sections: &[TrackSection],
    detectors: &[Detector],
    buffer_stops: &[BufferStop],
    switches: &[Switch],
    max_route_length: Option<f64>,
) -> Vec<Route> {
    let mut graph = Graph::default();
    graph.load(track_sections, detectors, buffer_stops, switches);

    let from_buffers = buffer_stops
        .iter()
        .flat_map(|b| graph.one_to_all_routes(Node::BufferStop(b.id.clone()), max_route_length));

    let from_detectors = detectors
        .iter()
        .flat_map(|d| graph.one_to_all_routes(Node::Detector(d.id.clone()), max_route_length));

    from_buffers.chain(from_detectors).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use schemas::infra::BufferStop;
    use schemas::infra::Detector;
    use schemas::infra::RailJson;
    use schemas::infra::TrackSection;

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
        let railjson = min_infra();
        g.load(
            &railjson.track_sections,
            &railjson.detectors,
            &railjson.buffer_stops,
            &railjson.switches,
        );
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
            EdgeType::Switch {
                id: "switch".into(),
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
        assert_eq!(1, route.switches_directions.len());
    }

    #[test]
    /* --s-- one track, one detector, two buffers */
    fn minimal_routes() {
        let railjson = min_infra();
        let routes = super::routes(
            &railjson.track_sections,
            &railjson.detectors,
            &railjson.buffer_stops,
            &railjson.switches,
            None,
        );
        assert_eq!(4, routes.len());
    }

    #[test]
    /* ----o---d---
            \------
        The test case has one switch and one detector
    */
    fn generate_routes() {
        let railjson =
            crate::osm_to_railjson::parse_osm("src/tests/routes.osm.pbf".into(), false, None)
                .unwrap();
        let routes = super::routes(
            &railjson.track_sections,
            &railjson.detectors,
            &railjson.buffer_stops,
            &railjson.switches,
            None,
        );
        assert_eq!(6, routes.len());
        let routes_with_switches_count = routes
            .iter()
            .filter(|r| r.switches_directions.len() == 1)
            .count();
        assert_eq!(4, routes_with_switches_count);
    }

    #[test]
    fn max_route_length() {
        //                          /---------- 10.0 --------- end 1
        //   start ----- 1.0 ----- o ---------- 20.0 --------- end 2

        // Identifiers
        let track1 = Identifier::from("track1");

        // Nodes
        let start = Node::BufferStop("start".into());
        let switch = Node::from_track_endpoint(&track1, Endpoint::End);
        let end1 = Node::BufferStop("end1".into());
        let end2 = Node::BufferStop("end2".into());

        // Graph construction
        let mut g = Graph::default();
        g.add_symmetrical_edge(start.clone(), switch.clone(), EdgeType::Track, 1.0);
        g.add_symmetrical_edge(switch.clone(), end1.clone(), EdgeType::Track, 10.0);
        g.add_symmetrical_edge(switch.clone(), end2.clone(), EdgeType::Track, 20.0);

        // Routes
        let routes = g.one_to_all_routes(start.clone(), None);
        assert_eq!(routes.len(), 2);

        let routes = g.one_to_all_routes(start.clone(), Some(12.0));
        assert_eq!(routes.len(), 1);

        let routes = g.one_to_all_routes(start, Some(5.0));
        assert_eq!(routes.len(), 0);
    }
}
