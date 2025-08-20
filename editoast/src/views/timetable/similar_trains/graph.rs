use crate::views::timetable::similar_trains::OperationalPoint;
use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;

use itertools::Itertools as _;

use crate::views::timetable::similar_trains::new_train;
use crate::views::timetable::similar_trains::new_train::Segment;
use crate::views::timetable::similar_trains::past_train;

#[derive(Clone, PartialEq, Eq, Hash)]
pub(super) struct Waypoint {
    pub(super) op: OperationalPoint,
    pub(super) stop: bool,
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}{}", self.op, if self.stop { "[STOP]" } else { "" },)
    }
}

type InnerGraph = petgraph::graph::DiGraph<GraphNode, ()>;
type NodeIndex = petgraph::graph::NodeIndex;

#[derive(Debug)]
struct GraphNode {
    waypoint: Waypoint,
    trains: HashSet<past_train::Id>,
}

#[derive(Debug, Default)]
pub(super) struct Graph {
    graph: InnerGraph,
    ops_index: HashMap<OperationalPoint, NodeIndex>,
}

impl Graph {
    fn get_node(&self, op: &OperationalPoint) -> Option<&GraphNode> {
        self.ops_index
            .get(op)
            .and_then(|&node| self.graph.node_weight(node))
    }

    fn get_or_create_node(&mut self, waypoint: Waypoint, train_id: past_train::Id) -> NodeIndex {
        if let Some(node) = self.ops_index.get(&waypoint.op) {
            self.graph
                .node_weight_mut(*node)
                .unwrap()
                .trains
                .insert(train_id);
            *node
        } else {
            let key = waypoint.op.clone();
            let node = self.graph.add_node(GraphNode {
                waypoint,
                trains: HashSet::from([train_id]),
            });
            self.ops_index.insert(key, node);
            node
        }
    }

    pub(super) fn push(
        &mut self,
        train_id: past_train::Id,
        waypoints: impl Iterator<Item = Waypoint>,
    ) {
        for (wp1, wp2) in waypoints.into_iter().tuple_windows() {
            let from = self.get_or_create_node(wp1, train_id);
            let to = self.get_or_create_node(wp2, train_id);
            self.graph
                .find_edge(from, to)
                .unwrap_or_else(|| self.graph.add_edge(from, to, ()));
        }
    }

    fn trains_on_path<'a>(
        &self,
        initial: &'a new_train::Waypoint,
        target: &'a new_train::Waypoint,
        max_distance: usize,
    ) -> TrainsOnPath<'a> {
        let Some(from) = self.ops_index.get(&initial.op) else {
            return TrainsOnPath::MissingInitialWaypoint(initial);
        };
        let Some(to) = self.ops_index.get(&target.op) else {
            return TrainsOnPath::MissingTargetWaypoint(target);
        };

        let aetoile = petgraph::algo::astar(&self.graph, *from, |n| n == *to, |_| 1, |_| 0);

        match aetoile {
            Some((_, path)) if !path.is_empty() && path.len() <= max_distance => {
                let mut trains = self.graph.node_weight(*from).unwrap().trains.clone();
                debug_assert_eq!(path.first(), Some(from));
                debug_assert_eq!(path.last(), Some(to));
                for node in path.into_iter().skip(1) {
                    let on_path = &self.graph.node_weight(node).unwrap().trains;
                    trains.retain(|train| on_path.contains(train));
                }
                TrainsOnPath::Trains(trains)
            }
            Some(_) => TrainsOnPath::MaxDistanceExceeded(max_distance),
            None => TrainsOnPath::NoPathFound { initial, target },
        }
    }

    #[cfg(debug_assertions)]
    pub(super) fn to_dot(&self) -> String {
        let pretty = self.graph.map(
            |_, GraphNode { waypoint, trains }| {
                let mut train_ids = trains.iter().map(|id| id.to_string()).collect::<Vec<_>>();
                train_ids.sort();
                let names = train_ids.join(",");
                format!("{waypoint:?}  —  {names}")
            },
            |_, ()| String::new(),
        );
        let dot = petgraph::dot::Dot::with_config(&pretty, &[petgraph::dot::Config::EdgeNoLabel]);
        format!("{dot:?}")
    }
}

enum TrainsOnPath<'a> {
    Trains(HashSet<past_train::Id>),
    MissingInitialWaypoint(&'a new_train::Waypoint),
    MissingTargetWaypoint(&'a new_train::Waypoint),
    MaxDistanceExceeded(usize),
    NoPathFound {
        initial: &'a new_train::Waypoint,
        target: &'a new_train::Waypoint,
    },
}

#[derive(educe::Educe)]
#[educe(Debug)]
pub(super) struct MatchingState {
    path: VecDeque<new_train::Waypoint>,
    #[educe(Debug = "ignore")]
    graph: Graph,
    pub(super) correct_trains_so_far: HashSet<past_train::Id>,
    current_waypoint: new_train::Waypoint,
    skipped: Option<new_train::Waypoint>,
}

impl MatchingState {
    pub(super) fn try_new(segment: Segment, graph: Graph) -> Result<Self, ()> {
        let mut path = segment.into_path();
        let current_waypoint = path.pop_front().ok_or(())?;
        let trains = graph
            .get_node(&current_waypoint.op)
            .ok_or(())?
            .trains
            .clone();

        Ok(Self {
            path,
            correct_trains_so_far: trains,
            graph,
            current_waypoint,
            skipped: None,
        })
    }

    #[tracing::instrument(skip_all, err)]
    pub(super) fn advance(mut self) -> Result<Self, AdvancementError> {
        let Some(target_waypoint) = self.path.pop_front() else {
            return Err(AdvancementError {
                last_state: Box::new(self),
                error: AdvancementErrorKind::ReachedPathEnding,
            });
        };

        tracing::debug!(
            current_waypoint = ?self.current_waypoint,
            ?target_waypoint,
            skipped_waypoint = ?self.skipped,
            trains = ?self.correct_trains_so_far,
            "matching state iteration"
        );

        let (trains, current_waypoint, to_skip) = match (
            self.graph
                .trains_on_path(&self.current_waypoint, &target_waypoint, 2),
            self.skipped,
        ) {
            (TrainsOnPath::Trains(trains), _) => (trains, target_waypoint, None),
            (TrainsOnPath::MissingInitialWaypoint(wp), _) => unreachable!(
                "initial waypoints cannot be missing, this is a graph construction bug {wp:?}"
            ),
            (TrainsOnPath::MissingTargetWaypoint(target), None) => {
                tracing::debug!(
                    initial = ?self.current_waypoint,
                    target = ?target,
                    "target waypoint from new train is missing from exploration graph — attempt to skip"
                );
                (HashSet::new(), self.current_waypoint, Some(target_waypoint))
            }
            (TrainsOnPath::NoPathFound { initial, target }, None) => {
                tracing::debug!(
                    ?initial,
                    ?target,
                    "no path found between new train waypoints in exploration graph — attempt to skip"
                );
                (HashSet::new(), self.current_waypoint, Some(target_waypoint))
            }
            (TrainsOnPath::MaxDistanceExceeded(max_distance), None) => {
                tracing::debug!(
                    ?max_distance,
                    initial = ?self.current_waypoint,
                    target = ?target_waypoint,
                    "max distance exceeded between new train waypoints in exploration graph — attempt to skip"
                );
                (HashSet::new(), self.current_waypoint, Some(target_waypoint))
            }
            (_, Some(skipped)) => {
                let blocked = AdvancementErrorKind::IrremediablyBlocked {
                    current: self.current_waypoint.clone(),
                    targeted: target_waypoint.clone(),
                    skipped: skipped.clone(),
                };
                // put back moved values to keep the state identical to before processing
                self.path.push_front(target_waypoint);
                self.skipped = Some(skipped);
                return Err(AdvancementError {
                    last_state: Box::new(self),
                    error: blocked,
                });
            }
        };

        self.correct_trains_so_far
            .retain(|train| trains.contains(train));

        Ok(Self {
            correct_trains_so_far: self.correct_trains_so_far,
            current_waypoint,
            path: self.path,
            graph: self.graph,
            skipped: to_skip,
        })
    }
}

#[derive(derive_more::Display)]
#[display("{error:?}")]
pub(super) struct AdvancementError {
    #[display(skip)]
    pub(super) last_state: Box<MatchingState>,
    pub(super) error: AdvancementErrorKind,
}

#[derive(Debug)]
pub(super) enum AdvancementErrorKind {
    ReachedPathEnding,
    IrremediablyBlocked {
        current: new_train::Waypoint,
        targeted: new_train::Waypoint,
        skipped: new_train::Waypoint,
    },
}
