use smol_str::SmolStr;

use super::graph;

#[derive(Debug)]
pub(super) struct PastSchedule {
    name: SmolStr,
    path: Vec<graph::Waypoint>,
}

impl PastSchedule {
    pub(super) fn new(name: SmolStr, path: impl IntoIterator<Item = graph::Waypoint>) -> Self {
        Self {
            name,
            path: path.into_iter().collect(),
        }
    }

    pub(super) fn name(&self) -> SmolStr {
        self.name.clone()
    }
}
