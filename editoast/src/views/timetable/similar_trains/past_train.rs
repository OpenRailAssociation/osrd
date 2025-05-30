use std::collections::HashMap;
use std::collections::HashSet;

use itertools::Itertools as _;
use smol_str::SmolStr;

use crate::views::timetable::similar_trains::Codes;
use crate::views::timetable::similar_trains::new_train::Segment;

use super::graph;

pub(super) type Name = SmolStr;

#[derive(Debug)]
pub(super) struct PastTrain {
    name: Name, // TODO: use train schedule ID
    path: Vec<graph::Waypoint>,
}

impl PastTrain {
    pub(super) fn new(name: Name, path: impl IntoIterator<Item = graph::Waypoint>) -> Self {
        Self {
            name,
            path: path.into_iter().collect(),
        }
    }

    pub(super) fn name(&self) -> Name {
        self.name.clone()
    }

    fn iter_stops(&self) -> impl Iterator<Item = &graph::Waypoint> {
        self.path.iter().filter(|wp| wp.stop)
    }

    pub(super) fn rank(&self, waypoint_codes: &Codes) -> Option<usize> {
        self.path
            .iter()
            .position(|graph::Waypoint { codes, .. }| codes == waypoint_codes)
    }

    pub(super) fn clamp_path(&self, segment: &Segment) -> Option<&[graph::Waypoint]> {
        let start = self.rank(&segment.begin().codes);
        let end = self.rank(&segment.end().codes);

        match (start, end) {
            (Some(s), Some(e)) if s <= e => Some(&self.path[s..=e]),
            (Some(_), Some(_)) => {
                tracing::debug!(
                    begin = ?segment.begin(),
                    end = ?segment.end(),
                    past_train = %self.name,
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
    segment_index: HashMap<(Codes, Codes), HashSet<usize>>,
}

impl Pool {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn trains_in_segment(&self, segment: &Segment) -> impl Iterator<Item = &PastTrain> {
        let key = (segment.begin().codes.clone(), segment.end().codes.clone());
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
                let key = (stop1.codes.clone(), stop2.codes.clone());
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
