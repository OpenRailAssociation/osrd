use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;

use educe::Educe;
use itertools::Itertools;

use crate::models::similar_schedule;

use super::request;

type Graph = petgraph::graph::DiGraph<GraphNode, ()>;
type NodeIndex = petgraph::graph::NodeIndex;

#[derive(Debug)]
struct GraphNode {
    waypoint: similar_schedule::Waypoint,
    schedules: HashSet<String>,
}

#[derive(Debug, Default)]
pub(super) struct ReferenceGraph {
    graph: Graph,
    // index: ci -> ch -> node_index
    cich_index: HashMap<u32, HashMap<Option<String>, NodeIndex>>,
}

impl ReferenceGraph {
    fn get_or_create_node(
        &mut self,
        waypoint: similar_schedule::Waypoint,
        schedule_name: &str,
    ) -> NodeIndex {
        if let Some(node) = self
            .cich_index
            .get(&waypoint.ci)
            .and_then(|map| map.get(&waypoint.ch))
        {
            self.graph
                .node_weight_mut(*node)
                .unwrap()
                .schedules
                .insert(schedule_name.to_owned());
            *node
        } else {
            let ci = waypoint.ci;
            let ch = waypoint.ch.clone();
            let node = self.graph.add_node(GraphNode {
                waypoint,
                schedules: HashSet::new(),
            });
            self.cich_index.entry(ci).or_default().insert(ch, node);
            node
        }
    }

    pub(super) fn push(
        &mut self,
        schedule_name: String,
        waypoints: Vec<similar_schedule::Waypoint>,
    ) {
        for (wp1, wp2) in waypoints.into_iter().tuple_windows() {
            let from = self.get_or_create_node(wp1, &schedule_name);
            let to = self.get_or_create_node(wp2, &schedule_name);
            self.graph
                .find_edge(from, to)
                .unwrap_or_else(|| self.graph.add_edge(from, to, ()));
        }
    }

    fn find_successor(
        &self,
        train_location: &similar_schedule::Waypoint,
        target_location: &similar_schedule::Waypoint,
    ) -> Option<HashSet<String>> {
        let from = self
            .cich_index
            .get(&train_location.ci)
            .and_then(|map| map.get(&train_location.ch))
            .expect("graph construction fail");
        let to = self
            .cich_index
            .get(&target_location.ci)
            .and_then(|map| map.get(&target_location.ch))?;

        let aetoile = petgraph::algo::astar(&self.graph, *from, |n| n == *to, |_| 1, |_| 0);

        match aetoile {
            Some((_, path)) if !path.is_empty() && path.len() <= 2 => {
                let mut schedules = self.graph.node_weight(*from).unwrap().schedules.clone();
                debug_assert_eq!(path.first(), Some(from));
                debug_assert_eq!(path.last(), Some(to));
                for node in path.into_iter().skip(1) {
                    let on_path = &self.graph.node_weight(node).unwrap().schedules;
                    schedules = schedules.intersection(on_path).cloned().collect();
                }
                Some(schedules)
            }
            Some(_) | None => None,
        }
    }

    pub(super) fn to_dot(&self) -> String {
        let pretty = self.graph.map(
            |_,
             GraphNode {
                 waypoint: similar_schedule::Waypoint { ci, ch, stop },
                 schedules,
             }| {
                let mut names = schedules
                    .iter()
                    .map(|name| name.as_str())
                    .collect::<Vec<_>>();
                names.sort();
                let names = names.join(",");
                format!(
                    "{ci}:{}{}  —  {names}",
                    ch.as_deref().unwrap_or("ø"),
                    if *stop { "[STOP]" } else { "" }
                )
            },
            |_, ()| String::new(),
        );
        let dot = petgraph::dot::Dot::with_config(&pretty, &[petgraph::dot::Config::EdgeNoLabel]);
        format!("{dot:?}").replace("\\\"", "")
    }
}

#[derive(Educe)]
#[educe(Debug)]
pub(super) struct MatchingState {
    pub(super) path: VecDeque<request::Waypoint>,
    #[educe(Debug = "ignore")]
    pub(super) graph: ReferenceGraph,
    pub(super) correct_schedules_so_far: HashSet<String>,
    pub(super) current_waypoint: similar_schedule::Waypoint,
    pub(super) skipped: Option<similar_schedule::Waypoint>,
}

impl MatchingState {
    pub(super) fn new(
        request::Segment(mut waypoints): request::Segment,
        graph: ReferenceGraph,
    ) -> Self {
        let current_waypoint = waypoints.pop_front().expect("empty segment").into();
        Self {
            path: waypoints,
            graph,
            correct_schedules_so_far: HashSet::new(),
            current_waypoint,
            skipped: None,
        }
    }

    #[inline]
    pub(super) fn keep_advancing(&self) -> bool {
        !self.path.is_empty()
    }

    pub(super) fn advance(mut self) -> Self {
        let Some(next_waypoint) = self.path.pop_front() else {
            return self;
        };
        let target = next_waypoint.into();

        tracing::debug!(
            current_waypoint = ?self.current_waypoint,
            target_waypoint = ?target,
            skipped_waypoint = ?self.skipped,
            schedules = ?self.correct_schedules_so_far,
            "matching state iteration"
        );

        let (schedules, current_waypoint, to_skip) = match (
            self.graph.find_successor(&self.current_waypoint, &target),
            self.skipped,
        ) {
            (Some(schedules), _) => (schedules, target, None),
            (None, None) => (HashSet::new(), self.current_waypoint, Some(target)),
            (None, Some(skipped)) => {
                panic!(
                    "graph exploration failed: having to skip both successive waypoints {skipped:?} and {:?}",
                    &self.current_waypoint
                );
            }
        };

        Self {
            correct_schedules_so_far: if self.correct_schedules_so_far.is_empty() {
                schedules
            } else if schedules.is_empty() {
                self.correct_schedules_so_far
            } else {
                self.correct_schedules_so_far
                    .intersection(&schedules)
                    .cloned()
                    .collect()
            },
            current_waypoint,
            path: self.path,
            graph: self.graph,
            skipped: to_skip,
        }
    }
}
