use std::collections::HashMap;
use std::collections::HashSet;

use itertools::Itertools as _;

use crate::views::timetable::similar_trains::OperationalPoint;
use crate::views::timetable::similar_trains::new_train::Segment;

use super::graph;

pub(super) type Id = i64;

#[derive(Debug)]
pub(super) struct PastTrain {
    id: Id,
    path: Vec<graph::Waypoint>,
}

impl PastTrain {
    pub(super) fn new(id: Id, path: impl IntoIterator<Item = graph::Waypoint>) -> Self {
        Self {
            id,
            path: path.into_iter().collect(),
        }
    }

    pub(super) fn id(&self) -> Id {
        self.id
    }

    fn iter_stops(&self) -> impl Iterator<Item = &graph::Waypoint> {
        self.path.iter().filter(|wp| wp.stop)
    }

    pub(super) fn rank(&self, waypoint_op: &OperationalPoint) -> Option<usize> {
        self.path
            .iter()
            .position(|graph::Waypoint { op, .. }| op == waypoint_op)
    }

    pub(super) fn clamp_path(&self, segment: &Segment) -> Option<&[graph::Waypoint]> {
        let start = self.rank(&segment.begin().op);
        let end = self.rank(&segment.end().op);

        match (start, end) {
            (Some(s), Some(e)) if s <= e => Some(&self.path[s..=e]),
            (Some(_), Some(_)) => {
                tracing::debug!(
                    begin = ?segment.begin(),
                    end = ?segment.end(),
                    past_train = %self.id,
                    "past train found for segment, but not in the opposite direction"
                );
                None
            }
            _ => None,
        }
    }
}

#[derive(Debug, Default)]
pub(super) struct Pool {
    trains: Vec<PastTrain>,
    segment_index: HashMap<(OperationalPoint, OperationalPoint), HashSet<usize>>,
}

impl Pool {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn trains_in_segment(&self, segment: &Segment) -> impl Iterator<Item = &PastTrain> {
        let key = (segment.begin().op.clone(), segment.end().op.clone());
        self.segment_index
            .get(&key)
            .into_iter()
            .flat_map(|indices| indices.iter().map(|&i| &self.trains[i]))
    }
}

impl Extend<PastTrain> for Pool {
    fn extend<T: IntoIterator<Item = PastTrain>>(&mut self, iter: T) {
        for train in iter {
            let index = self.trains.len();
            for (stop1, stop2) in train.iter_stops().tuple_windows() {
                let key = (stop1.op.clone(), stop2.op.clone());
                self.segment_index.entry(key).or_default().insert(index);
            }
            self.trains.push(train);
        }
    }
}

impl FromIterator<PastTrain> for Pool {
    fn from_iter<T: IntoIterator<Item = PastTrain>>(iter: T) -> Self {
        let mut pool = Pool::new();
        pool.extend(iter);
        pool
    }
}
