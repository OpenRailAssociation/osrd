use std::collections::HashMap;
use std::collections::HashSet;

use itertools::Itertools as _;
use smol_str::SmolStr;

use crate::views::timetable::similar_schedules::new_schedule::Segment;

use super::graph;

pub(super) type Name = SmolStr;

#[derive(Debug)]
pub(super) struct PastSchedule {
    name: Name,
    path: Vec<graph::Waypoint>,
}

impl PastSchedule {
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

    pub(super) fn rank(&self, primary_code: u64, secondary_code: Option<SmolStr>) -> Option<usize> {
        self.path.iter().position(|wp| {
            wp.primary_code() == primary_code && wp.secondary_code() == secondary_code
        })
    }

    pub(super) fn clamp_path(&self, segment: &Segment) -> Option<&[graph::Waypoint]> {
        let start = self.rank(
            segment.begin().primary_code(),
            segment.begin().secondary_code().clone(),
        );
        let end = self.rank(
            segment.end().primary_code(),
            segment.end().secondary_code().clone(),
        );

        match (start, end) {
            (Some(s), Some(e)) if s <= e => Some(&self.path[s..=e]),
            (Some(_), Some(_)) => {
                tracing::debug!(
                    begin = ?segment.begin(),
                    end = ?segment.end(),
                    past_schedule = %self.name,
                    "past schedule found for segment, but not in the opposite direction"
                );
                None
            }
            _ => None,
        }
    }
}

type SegmentKey = ((u64, Option<SmolStr>), (u64, Option<SmolStr>));
type SegmentIndex = HashMap<SegmentKey, HashSet<usize>>;

#[derive(Debug, Default)]
pub(super) struct Pool {
    schedules: Vec<PastSchedule>,
    segment_index: SegmentIndex,
}

impl Pool {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn schedules_in_segment(
        &self,
        segment: &Segment,
    ) -> impl Iterator<Item = &PastSchedule> {
        let key = (
            (
                segment.begin().primary_code(),
                segment.begin().secondary_code().clone(),
            ),
            (
                segment.end().primary_code(),
                segment.end().secondary_code().clone(),
            ),
        );
        self.segment_index
            .get(&key)
            .into_iter()
            .flat_map(|indices| indices.iter().map(|&i| &self.schedules[i]))
    }
}

impl Extend<PastSchedule> for Pool {
    fn extend<T: IntoIterator<Item = PastSchedule>>(&mut self, iter: T) {
        for schedule in iter {
            let index = self.schedules.len();
            for (wp1, wp2) in schedule.iter_stops().tuple_windows() {
                let key = (
                    (wp1.primary_code(), wp1.secondary_code()),
                    (wp2.primary_code(), wp2.secondary_code()),
                );
                self.segment_index.entry(key).or_default().insert(index);
            }
            self.schedules.push(schedule);
        }
    }
}

impl FromIterator<PastSchedule> for Pool {
    fn from_iter<T: IntoIterator<Item = PastSchedule>>(iter: T) -> Self {
        let mut pool = Pool::new();
        pool.extend(iter);
        pool
    }
}
