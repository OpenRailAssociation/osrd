//! In order to build all the routes, we must do a graph search.
//! This module provides this graph search and can be understood in three different parts
//! - part 1: type definitions for nodes and edges
//! - part 2: build the graph
//! - part 3: compute the routes

use std::collections::HashMap;

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
    length: HashMap<Identifier, f64>,
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

        // We store each length in an array in order to use it as an heuristic later
        for track in track_sections {
            self.length.insert(track.id.clone(), track.length);
        }

        // We need to split handle separately the signals that are forward
        let detectors_by_track = detectors
            .iter()
            .map(|detector| (&detector.track, detector))
            .into_group_map();

        for (track, detectors) in &detectors_by_track {

            let u = Node::from_track_endpoint(track, Endpoint::Begin);
            let v = Node::from_track_endpoint(track, Endpoint::End);
            
            // When going from start to end
            // We only consider the last detector (closest to end) that is on the same track
            // All the other can be considered as block defining
            let detector = detectors
                .iter()
                // .filter(|d| (if d dans le sens opposé))
                .max_by_key(|d| (d.position * 1000.0).round() as u64)
                .expect("missing detector");
            let d = Node::Detector(detector.id.clone());
            self.add_directed_edge(u.clone(), d.clone(), EdgeType::ToDetector);
            self.add_directed_edge(d.clone(), v.clone(), EdgeType::FromDetector(Direction::StartToStop));

            // When going from end to start
            // We only consider the first detector (closest to start) that is on the same track
            // All the other can be considered as block defining
            let detector = detectors
                .iter()
                // .filter(|d| (if d dans le bon sens))
                .min_by_key(|d| (d.position * 1000.0).round() as u64) //Because floats aren’t sortable
                .expect("missing detector");    // si pas de détecteur trouvé, on rajoute un edge
            let d = Node::Detector(detector.id.clone());
            self.add_directed_edge(v.clone(), d.clone(), EdgeType::ToDetector);
            self.add_directed_edge(d.clone(), u.clone(), EdgeType::FromDetector(Direction::StopToStart));
        }

        for buffer in buffer_stops {
            let b = Node::BufferStop(buffer.id.clone());
            if buffer.position < 0.1 {
                let u = Node::from_track_endpoint(&buffer.track, Endpoint::Begin);
                self.add_symmetrical_edge(b, u, EdgeType::Buffer(Direction::StartToStop));
            } else {
                let u = Node::from_track_endpoint(&buffer.track, Endpoint::End);
                self.add_symmetrical_edge(b, u, EdgeType::Buffer(Direction::StopToStart));
            }
        }

        for track in track_sections {
            // We only consider tracks that have no detector for the given direction on them as we split them
            let u = Node::from_track_endpoint(&track.id, Endpoint::Begin);
            let v = Node::from_track_endpoint(&track.id, Endpoint::End);
            if !detectors_by_track.contains_key(&track.id) {
                self.add_symmetrical_edge(v.clone(), u.clone(), EdgeType::Track);
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

    // Returns the length of the track associated to the node
    fn get_length(&self, n: &Node) -> f64 {
        match n {
            Node::TrackEndpoint(track_endpoint) => {
                match self.length.get(&track_endpoint.track) {
                    Some(f) => { f.clone() }
                    _ => { 0.0 }
                }
            }
            _ => { 0.0 }
        }
    }

    // Computes all the routes from one Node (buffer stop or detector) to all others
    // The routes don’t go beyond a detector or a buffer stop
    fn one_to_all_routes(&self, start: Node, max_distance: Option<f64>) -> Vec<Route> {

        let mut result = vec![];
        let mut count = 0;
        let mut parent = HashMap::new();
        let mut stack = Vec::from([&start]);
        let mut distance = HashMap::new();

        distance.insert(&start, self.get_length(&start).clone());

        while let Some(current) = stack.pop() {
            if let Some(successors) = self.successors.get(current) {
                for succ in successors {

                    // Get the distance of the current and next node from start
                    let current_length = match distance.get(current) {
                        Some(f) => { *f }
                        _ => { 0.0 }
                    };
                    let new_length = self.get_length(succ);

                    match (current.clone(), succ.clone()) {
                        (Node::TrackEndpoint(v1), Node::TrackEndpoint(v2)) => {
                            println!("Going from {} to {}", v1.track, v2.track);
                        }
                        _ => {}
                    }

                    println!("Current length: {}", current_length);
                    println!("New length to add: {}", new_length);
                    println!();

                    // Add the successor if valid and close enough to start
                    if max_distance.is_none() || current_length + new_length < max_distance.expect("") {

                        // Add the successor distance computed from the current distance to the hashmap
                        distance.insert(succ, current_length.clone() + new_length.clone());

                        // Checks whether the successor is valid and add it to the stack
                        if self.valid_successor(&start, current, succ, &parent) {
                            parent.insert(succ, current);
                            match &succ {
                                // All routes end at a buffer or detector and we build it
                                Node::BufferStop(_) | Node::Detector(_) => {
                                    result.push(self.build_route(count, succ, &parent));
                                    println!("Found a route of length {}", distance.get(succ).expect(""));
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

    // Once we found a route, we must build by scanning the predecessors and return its length as well
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
    max_distance: Option<f64>,
) -> Vec<Route> {
    let mut graph = Graph::default();
    graph.load(track_sections, detectors, buffer_stops, switches);

    let from_buffers = buffer_stops
        .iter()
        .flat_map(|b| graph.one_to_all_routes(Node::BufferStop(b.id.clone()), max_distance.clone()));

    let from_detectors = detectors
        .iter()
        .flat_map(|d| graph.one_to_all_routes(Node::Detector(d.id.clone()), max_distance.clone()));

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
            crate::osm_to_railjson::parse_osm("src/tests/routes.osm.pbf".into(), false).unwrap();
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
    fn max_distance() {

        //                      /---------- 10.0 ---------\
        //   s ----- 1.0 ----- o ----- 5.0 ----- 3.0 ----- o ----- 1.0 ----- e

        // Identifiers
        let t1: Identifier = "t1".to_string().into();
        let t2: Identifier = "t2".to_string().into();
        let t3: Identifier = "t3".to_string().into();
        let t4: Identifier = "t4".to_string().into();
        let t5: Identifier = "t5".to_string().into();
        let s1: Identifier = "s1".to_string().into();
        let s2: Identifier = "s2".to_string().into();
        let p1t: Identifier = "p1t".to_string().into();
        let p1b: Identifier = "p1b".to_string().into();
        let p2t: Identifier = "p2t".to_string().into();
        let p2b: Identifier = "p2b".to_string().into();

        // Lengths
        let l1 = 1.0;
        let l2 = 10.0;
        let l3 = 5.0;
        let l4 = 3.0;
        let l5 = 1.0;

        // Nodes
        let buffer_start = Node::BufferStop("start".into());
        let buffer_end = Node::BufferStop("end".into());
        let switch_start = Node::from_track_endpoint(&t1, Endpoint::End);
        let switch_end = Node::from_track_endpoint(&t5, Endpoint::Begin);
        let track_start = Node::from_track_endpoint(&t1, Endpoint::Begin);
        let track_start_top = Node::from_track_endpoint(&t2, Endpoint::Begin);
        let track_start_bot = Node::from_track_endpoint(&t3, Endpoint::Begin);
        let track_end_top = Node::from_track_endpoint(&t2, Endpoint::End);
        let track_end_bot = Node::from_track_endpoint(&t4, Endpoint::End);
        let track_middle_bot = Node::from_track_endpoint(&t4, Endpoint::Begin);
        let track_end = Node::from_track_endpoint(&t5, Endpoint::End);

        // Graph construction
        let mut g = Graph::default();
        g.add_symmetrical_edge(buffer_start.clone(), track_start.clone(), EdgeType::Buffer(Direction::StartToStop));
        g.add_symmetrical_edge(buffer_end.clone(), track_end.clone(), EdgeType::Buffer(Direction::StopToStart));
        g.add_directed_edge(track_start.clone(), switch_start.clone(), EdgeType::Track);
        g.add_directed_edge(switch_end.clone(), track_end.clone(), EdgeType::Track);
        g.add_directed_edge(track_start_top.clone(), track_end_top.clone(), EdgeType::Track);
        g.add_directed_edge(track_start_bot.clone(), track_middle_bot.clone(), EdgeType::Track);
        g.add_directed_edge(track_middle_bot.clone(), track_end_bot.clone(), EdgeType::Track);
        g.add_symmetrical_edge(switch_start.clone(), track_start_top.clone(), EdgeType::Switch { id: s1.clone(), port: p1t });
        g.add_symmetrical_edge(switch_start.clone(), track_start_bot.clone(), EdgeType::Switch { id: s1.clone(), port: p1b });
        g.add_symmetrical_edge(switch_end.clone(), track_end_top.clone(), EdgeType::Switch { id: s2.clone(), port: p2t });
        g.add_symmetrical_edge(switch_end.clone(), track_end_bot.clone(), EdgeType::Switch { id: s2.clone(), port: p2b });
        g.length.insert(t1.clone(), l1);
        g.length.insert(t2.clone(), l2);
        g.length.insert(t3.clone(), l3);
        g.length.insert(t4.clone(), l4);
        g.length.insert(t5.clone(), l5);

        // Routes
        let routes = g.one_to_all_routes(buffer_start, None);
    }
}
