use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;

use itertools::Itertools as _;
use smol_str::SmolStr;

use crate::views::timetable::similar_schedules::new_schedule;
use crate::views::timetable::similar_schedules::new_schedule::Segment;
use crate::views::timetable::similar_schedules::past_schedule;

use super::SimilarSchedulesError;

#[derive(Clone, PartialEq, Eq, Hash)]
pub(super) struct Waypoint {
    pub(super) primary_code: u64,
    pub(super) secondary_code: Option<SmolStr>,
    pub(super) stop: bool,
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}{}{}",
            self.primary_code,
            self.secondary_code
                .as_ref()
                .map(|s| format!(":{s}"))
                .unwrap_or_default(),
            if self.stop { "[STOP]" } else { "" },
        )
    }
}

impl Waypoint {
    pub(super) fn primary_code(&self) -> u64 {
        self.primary_code
    }

    pub(super) fn secondary_code(&self) -> Option<SmolStr> {
        self.secondary_code.clone()
    }
}

type InnerGraph = petgraph::graph::DiGraph<GraphNode, ()>;
type NodeIndex = petgraph::graph::NodeIndex;

#[derive(Debug)]
struct GraphNode {
    waypoint: Waypoint,
    schedules: HashSet<past_schedule::Name>,
}

#[derive(Debug, Default)]
pub(super) struct Graph {
    graph: InnerGraph,
    // index: ci -> ch -> node_index
    cich_index: HashMap<u64, HashMap<Option<SmolStr>, NodeIndex>>,
}

impl Graph {
    fn get_or_create_node(
        &mut self,
        waypoint: Waypoint,
        schedule_name: past_schedule::Name,
    ) -> NodeIndex {
        if let Some(node) = self
            .cich_index
            .get(&waypoint.primary_code())
            .and_then(|map| map.get(&waypoint.secondary_code()))
        {
            self.graph
                .node_weight_mut(*node)
                .unwrap()
                .schedules
                .insert(schedule_name.to_owned());
            *node
        } else {
            let primary = waypoint.primary_code();
            let secondary = waypoint.secondary_code();
            let node = self.graph.add_node(GraphNode {
                waypoint,
                schedules: HashSet::new(),
            });
            self.cich_index
                .entry(primary)
                .or_default()
                .insert(secondary, node);
            node
        }
    }

    pub(super) fn push(
        &mut self,
        name: past_schedule::Name,
        waypoints: impl Iterator<Item = Waypoint>,
    ) {
        for (wp1, wp2) in waypoints.into_iter().tuple_windows() {
            let from = self.get_or_create_node(wp1, name.clone());
            let to = self.get_or_create_node(wp2, name.clone());
            self.graph
                .find_edge(from, to)
                .unwrap_or_else(|| self.graph.add_edge(from, to, ()));
        }
    }

    fn find_successor(
        &self,
        train_location: &new_schedule::Waypoint,
        target_location: &new_schedule::Waypoint,
    ) -> Result<Option<HashSet<past_schedule::Name>>, SimilarSchedulesError> {
        let from = self
            .cich_index
            .get(&train_location.primary_code())
            .and_then(|map| map.get(&train_location.secondary_code()))
            .ok_or(SimilarSchedulesError::GraphConstructionFailed)?;

        let to = match self
            .cich_index
            .get(&target_location.primary_code())
            .and_then(|map| map.get(&target_location.secondary_code()))
        {
            Some(to) => to,
            None => return Ok(None),
        };

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
                Ok(Some(schedules))
            }
            Some(_) | None => Ok(None),
        }
    }

    pub(super) fn to_dot(&self) -> String {
        let pretty = self.graph.map(
            |_,
             GraphNode {
                 waypoint,
                 schedules,
             }| {
                let mut names = schedules
                    .iter()
                    .map(|name| name.as_str())
                    .collect::<Vec<_>>();
                names.sort();
                let names = names.join(",");
                format!("{waypoint:?}  —  {names}")
            },
            |_, ()| String::new(),
        );
        let dot = petgraph::dot::Dot::with_config(&pretty, &[petgraph::dot::Config::EdgeNoLabel]);
        format!("{dot:?}")
    }
}

#[derive(educe::Educe)]
#[educe(Debug)]
pub(super) struct MatchingState {
    path: VecDeque<new_schedule::Waypoint>,
    #[educe(Debug = "ignore")]
    graph: Graph,
    pub(super) correct_schedules_so_far: HashSet<past_schedule::Name>,
    current_waypoint: new_schedule::Waypoint,
    skipped: Option<new_schedule::Waypoint>,
}

impl MatchingState {
    pub(super) fn new(segment: Segment, graph: Graph) -> Self {
        let mut path = segment.into_path();
        let current_waypoint = path.pop_front().expect("empty segment");
        Self {
            path,
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

    pub(super) fn advance(mut self) -> Result<Self, SimilarSchedulesError> {
        let Some(target_waypoint) = self.path.pop_front() else {
            return Ok(self);
        };

        tracing::debug!(
            current_waypoint = ?self.current_waypoint,
            ?target_waypoint,
            skipped_waypoint = ?self.skipped,
            schedules = ?self.correct_schedules_so_far,
            "matching state iteration"
        );

        let (schedules, current_waypoint, to_skip) = match (
            self.graph
                .find_successor(&self.current_waypoint, &target_waypoint)?,
            self.skipped,
        ) {
            (Some(schedules), _) => (schedules, target_waypoint, None),
            (None, None) => (HashSet::new(), self.current_waypoint, Some(target_waypoint)),
            (None, Some(skipped)) => {
                return Err(SimilarSchedulesError::GraphExplorationFailed {
                    skipped,
                    target_waypoint,
                });
            }
        };

        Ok(Self {
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
        })
    }
}
