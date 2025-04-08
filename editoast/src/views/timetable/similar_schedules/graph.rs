use std::collections::HashMap;
use std::collections::HashSet;

use itertools::Itertools as _;
use smol_str::SmolStr;

use crate::views::timetable::similar_schedules::past_schedule;

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

type InnerGraph = petgraph::graph::DiGraph<(), HashSet<past_schedule::Name>>;
type NodeIndex = petgraph::graph::NodeIndex;

#[derive(Debug, Default)]
pub(super) struct Graph {
    graph: InnerGraph,
    nodes: HashMap<Waypoint, NodeIndex>,
    inv_nodes: HashMap<NodeIndex, Waypoint>,
}

impl Graph {
    #[inline]
    fn get_or_create_node(&mut self, waypoint: Waypoint) -> NodeIndex {
        if let Some(node) = self.nodes.get(&waypoint) {
            *node
        } else {
            let node = self.graph.add_node(());
            self.nodes.insert(waypoint.clone(), node); // oh no
            self.inv_nodes.insert(node, waypoint);
            node
        }
    }

    pub(super) fn push<'a>(
        &mut self,
        name: past_schedule::Name,
        waypoints: impl Iterator<Item = &'a Waypoint>,
    ) {
        for (wp1, wp2) in waypoints.into_iter().tuple_windows() {
            let from = self.get_or_create_node(wp1.clone());
            let to = self.get_or_create_node(wp2.clone());
            let edge = self
                .graph
                .find_edge(from, to)
                .unwrap_or_else(|| self.graph.add_edge(from, to, HashSet::new()));
            self.graph
                .edge_weight_mut(edge)
                .unwrap()
                .insert(name.clone()); // cheap copy: SmolStr
        }
    }

    pub(super) fn to_dot(&self) -> String {
        let pretty = self.graph.map(
            |node_idx, _| {
                let wp = self.inv_nodes.get(&node_idx).unwrap();
                format!("{wp:?}")
            },
            |_, edge| {
                edge.iter()
                    .map(|name| name.as_str())
                    .collect::<Vec<_>>()
                    .join(",")
            },
        );
        let dot = petgraph::dot::Dot::new(&pretty);
        format!("{dot:?}")
    }
}
