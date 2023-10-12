use crate::models::pathfinding::Pathfinding;
use crate::schema::Direction;

use rangemap::RangeMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;
use std::ops::Range;

#[macro_export]
macro_rules! range_map {
    ($( $begin: expr , $end: expr => $value: expr ),*) => {{
         let mut map: RangeMap<Float, String> = ::rangemap::RangeMap::new();
         $( map.insert(($begin.into()..$end.into()), $value.into()); )*
         map
    }}
}

/// A struct to make f64 Ord, to use in RangeMap
#[derive(Debug, PartialEq, Copy, Clone, Serialize)]
pub struct Float(f64);

impl Float {
    fn new(f: f64) -> Self {
        assert!(f.is_finite());
        Self(f)
    }
}

impl From<f64> for Float {
    fn from(f: f64) -> Self {
        Self::new(f)
    }
}

impl Ord for Float {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0.partial_cmp(&other.0).unwrap()
    }
}

impl PartialOrd for Float {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Eq for Float {}

fn clip_range_map(
    range_map: &RangeMap<Float, String>,
    clip_range: Range<Float>,
) -> RangeMap<Float, String> {
    let mut res = RangeMap::new();
    for (range, value) in range_map.overlapping(&clip_range) {
        let range = range.start.max(clip_range.start)..range.end.min(clip_range.end);
        res.insert(range, value.clone());
    }
    res
}

// Transforms a range map as though it was traveled from point `entry` in the given direction.
fn travel_range_map(
    track_range_map: &RangeMap<Float, String>,
    entry: f64,
    direction: Direction,
) -> RangeMap<Float, String> {
    let mut res = RangeMap::new();
    for (range, value) in track_range_map.iter() {
        let (start, end) = match direction {
            Direction::StartToStop => (range.start.0, range.end.0),
            Direction::StopToStart => (range.end.0, range.start.0),
        };

        let range = (start - entry).abs().into()..(end - entry).abs().into();
        res.insert(range, value.clone());
    }
    res
}

/// Insert a range map in another, at the given offset.
fn extend_range_map(
    dest_range_map: &mut RangeMap<Float, String>,
    origin_range_map: RangeMap<Float, String>,
    offset: f64,
) {
    for (range, value) in origin_range_map.iter() {
        let range = (range.start.0 + offset).into()..(range.end.0 + offset).into();
        assert!(!dest_range_map.overlaps(&range), "range overlap");
        dest_range_map.insert(range, value.clone());
    }
}

pub fn make_path_range_map(
    value_maps_by_track: &HashMap<String, RangeMap<Float, String>>,
    pathfinding: &Pathfinding,
) -> RangeMap<Float, String> {
    let mut res = RangeMap::new();
    let mut offset = 0.;

    for track_range in pathfinding.merged_track_ranges() {
        let value_map = value_maps_by_track.get(&track_range.track as &str);
        if let Some(value_map) = value_map {
            let value_map =
                clip_range_map(value_map, track_range.begin.into()..track_range.end.into());
            let range_entry = match track_range.direction {
                Direction::StartToStop => track_range.begin,
                Direction::StopToStart => track_range.end,
            };
            let value_map = travel_range_map(&value_map, range_entry, track_range.direction);
            extend_range_map(&mut res, value_map, offset);
        }
        offset += track_range.end - track_range.begin;
    }

    res
}

/// A struct to represent range maps in responses
#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub struct RangedValue {
    pub begin: f64,
    pub end: f64,
    pub value: String,
}

impl RangedValue {
    pub fn list_from_range_map(range_map: &RangeMap<Float, String>) -> Vec<RangedValue> {
        range_map
            .iter()
            .map(|(range, mode)| RangedValue {
                begin: range.start.0,
                end: range.end.0,
                value: mode.to_string(),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::pathfinding::tests::simple_pathfinding;

    #[test]
    fn test_clip_range_map() {
        let range_map = range_map!(0.0, 10.0 => "a", 10.0, 20.0 => "b", 20.0, 30.0 => "c");

        let clipped = clip_range_map(&range_map, 5.0.into()..20.0.into());
        assert_eq!(clipped, range_map!(5.0, 10.0 => "a", 10.0, 20.0 => "b"));
    }

    #[test]
    fn test_travel_range_map_start_to_stop() {
        let range_map = range_map!(5.0, 10.0 => "a", 10.0, 20.0 => "b", 20.0, 30.0 => "c");

        let traveled = travel_range_map(&range_map, 5.0, Direction::StartToStop);
        assert_eq!(
            traveled,
            range_map!(0.0, 5.0 => "a", 5.0, 15.0 => "b", 15.0, 25.0 => "c")
        );
    }

    #[test]
    fn test_travel_range_map_stop_to_start() {
        let range_map = range_map!(0.0, 10.0 => "a", 10.0, 22.0 => "b", 22.0, 25.0 => "c");

        let traveled = travel_range_map(&range_map, 25.0, Direction::StopToStart);
        assert_eq!(
            traveled,
            range_map!(0.0, 3.0 => "c", 3.0, 15.0 => "b", 15.0, 25.0 => "a")
        );
    }

    #[test]
    #[should_panic]
    fn test_extend_range_map_overlap() {
        let mut dest_range_map = range_map!(0.0, 10.0 => "a", 10.0, 20.0 => "b");
        let origin_range_map = range_map!(0.0, 10.0 => "c", 10.0, 20.0 => "d");

        extend_range_map(&mut dest_range_map, origin_range_map, 5.0);
        assert_eq!(
            dest_range_map,
            range_map!(5.0, 15.0 => "c", 15.0, 25.0 => "d")
        );
    }

    #[test]
    fn test_extend_range_map() {
        let mut dest_range_map = range_map!(0.0, 10.0 => "a", 10.0, 20.0 => "b");
        let origin_range_map = range_map!(0.0, 10.0 => "b", 10.0, 20.0 => "c");

        extend_range_map(&mut dest_range_map, origin_range_map, 20.0);
        assert_eq!(
            dest_range_map,
            range_map!(0.0, 10.0 => "a", 10.0, 30.0 => "b", 30.0, 40.0 => "c")
        );
    }

    #[test]
    fn test_make_path_range_map() {
        let pathfinding = simple_pathfinding(0);
        let value_maps_by_track: HashMap<String, RangeMap<Float, String>> = [
            ("track_1".into(), range_map!(0.0, 10.0 => "A")),
            (
                "track_2".into(),
                range_map!(0.0, 5.0 => "B", 5.0, 10.0 => "A"),
            ),
            ("track_3".into(), range_map!(0.0, 10.0 => "B")),
        ]
        .iter()
        .cloned()
        .collect();

        let path_range_map = make_path_range_map(&value_maps_by_track, &pathfinding);
        assert_eq!(
            path_range_map,
            range_map!(
                0.0, 15.0 => "A",
                15.0, 30.0 => "B"
            )
        );
    }
}
