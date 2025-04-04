use std::collections::VecDeque;

use itertools::Itertools;
use smol_str::SmolStr;

#[derive(Debug, Clone)]
#[cfg_attr(test, derive(PartialEq, Eq))]
pub(super) struct Waypoint {
    primary_code: u64,
    secondary_code: Option<SmolStr>,
    kind: Kind,
}

#[derive(Debug, Clone)]
#[cfg_attr(test, derive(PartialEq, Eq))]
pub(super) enum Kind {
    PassingBy,
    Stop,
    Overtake,
}

impl Waypoint {
    pub(super) fn passing_by(primary_code: u64, secondary_code: Option<SmolStr>) -> Self {
        Self {
            primary_code,
            secondary_code,
            kind: Kind::PassingBy,
        }
    }

    pub(super) fn stop(primary_code: u64, secondary_code: Option<SmolStr>) -> Self {
        Self {
            primary_code,
            secondary_code,
            kind: Kind::Stop,
        }
    }

    pub(super) fn overtake(primary_code: u64, secondary_code: Option<SmolStr>) -> Self {
        Self {
            primary_code,
            secondary_code,
            kind: Kind::Overtake,
        }
    }

    pub(super) fn primary_code(&self) -> u64 {
        self.primary_code
    }

    pub(super) fn secondary_code(&self) -> Option<SmolStr> {
        self.secondary_code.clone()
    }
}

pub(super) struct NewSchedule {
    waypoints: Vec<Waypoint>,
}

#[derive(Debug, thiserror::Error)]
pub(super) enum ScheduleError {
    #[error("Not enough waypoints to create a schedule — at least two are required")]
    NotEnoughWaypoints,
    #[error("First provided waypoint is not a stop")]
    FirstWaypointIsntStop,
    #[error("Last provided waypoint is not a stop")]
    LastWaypointIsntStop,
}

impl NewSchedule {
    pub(super) fn new(
        waypoints: impl IntoIterator<Item = Waypoint>,
    ) -> Result<Self, ScheduleError> {
        let waypoints = waypoints.into_iter().collect_vec();
        if waypoints.len() < 2 {
            return Err(ScheduleError::NotEnoughWaypoints);
        }
        match (
            &waypoints.first().unwrap().kind,
            &waypoints.last().unwrap().kind,
        ) {
            (Kind::Stop, Kind::Stop) => Ok(Self { waypoints }),
            (Kind::Stop, _) => Err(ScheduleError::LastWaypointIsntStop),
            (_, _) => Err(ScheduleError::FirstWaypointIsntStop),
        }
    }

    pub(super) fn stops(&self) -> impl Iterator<Item = &Waypoint> {
        self.waypoints
            .iter()
            .filter(|w| matches!(w.kind, Kind::Stop))
    }

    pub(super) fn segment_endpoints(&self) -> impl Iterator<Item = (&Waypoint, &Waypoint)> {
        self.stops().tuple_windows()
    }

    /// Splits the schedule waypoints into segments between each stops
    ///
    /// The stop waypoint at the end of one segment is included in the next segment.
    pub(super) fn into_segments(self) -> Vec<Segment> {
        let Self { waypoints } = self;

        let mut segments = Vec::<VecDeque<Waypoint>>::new();
        for waypoint in waypoints {
            if matches!(waypoint.kind, Kind::Stop) {
                if let Some(last_segment) = segments.last_mut() {
                    last_segment.push_back(waypoint.clone());
                }
                segments.push(VecDeque::from([waypoint]));
            } else {
                if let Some(last_segment) = segments.last_mut() {
                    last_segment.push_back(waypoint);
                } else {
                    unreachable!("First waypoint is always a stop — checked in `NewSchedule::new`");
                }
            }
        }

        if segments.last().map(|s| s.len()) == Some(1) {
            segments.pop();
        }

        segments.into_iter().map(Segment::from_path).collect()
    }
}

#[derive(Debug, Clone)]
pub(super) struct Segment {
    begin: Waypoint,
    passing_by: VecDeque<Waypoint>,
    end: Waypoint,
}

impl Segment {
    pub(super) fn begin(&self) -> &Waypoint {
        &self.begin
    }

    pub(super) fn end(&self) -> &Waypoint {
        &self.end
    }

    pub(super) fn into_path(self) -> VecDeque<Waypoint> {
        let Self {
            begin,
            passing_by: mut path,
            end,
        } = self;
        path.push_front(begin);
        path.push_back(end);
        path
    }

    fn from_path(mut path: VecDeque<Waypoint>) -> Self {
        let begin = path
            .pop_front()
            .expect("Path must have at least two waypoints");
        let end = path
            .pop_back()
            .expect("Path must have at least two waypoints");
        assert!(
            matches!(begin.kind, Kind::Stop),
            "First waypoint must be a stop"
        );
        assert!(
            matches!(end.kind, Kind::Stop),
            "Last waypoint must be a stop"
        );
        Self {
            begin,
            passing_by: path,
            end,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_segmentation() {
        let waypoints = vec![
            Waypoint::stop(1, Some(SmolStr::new("a"))),
            Waypoint::passing_by(2, Some(SmolStr::new("b"))),
            Waypoint::passing_by(3, Some(SmolStr::new("c"))),
            Waypoint::stop(4, Some(SmolStr::new("d"))),
            Waypoint::passing_by(5, Some(SmolStr::new("e"))),
            Waypoint::stop(6, Some(SmolStr::new("f"))),
            Waypoint::stop(7, Some(SmolStr::new("g"))),
        ];
        let schedule = NewSchedule::new(waypoints.clone()).unwrap();

        let mut segments = schedule
            .into_segments()
            .into_iter()
            .map(Segment::into_path)
            .collect_vec();
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].make_contiguous(), &waypoints[0..=3]);
        assert_eq!(segments[1].make_contiguous(), &waypoints[3..=5]);
        assert_eq!(segments[2].make_contiguous(), &waypoints[5..=6]);
    }

    #[test]
    fn test_segment_endpoints() {
        let waypoints = vec![
            Waypoint::stop(1, Some(SmolStr::new("a"))),
            Waypoint::passing_by(2, Some(SmolStr::new("b"))),
            Waypoint::passing_by(3, Some(SmolStr::new("c"))),
            Waypoint::stop(4, Some(SmolStr::new("d"))),
            Waypoint::passing_by(5, Some(SmolStr::new("e"))),
            Waypoint::stop(6, Some(SmolStr::new("f"))),
            Waypoint::stop(7, Some(SmolStr::new("g"))),
        ];
        let schedule = NewSchedule::new(waypoints.clone()).unwrap();

        let endpoints = schedule.segment_endpoints().collect_vec();
        assert_eq!(
            endpoints,
            [
                (&waypoints[0], &waypoints[3]),
                (&waypoints[3], &waypoints[5]),
                (&waypoints[5], &waypoints[6]),
            ]
        );
    }
}
