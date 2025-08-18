use rangemap::RangeMap;
use serde::Deserialize;
use serde::Serialize;
use std::fmt::Debug;
use std::ops::Range;
use utoipa::ToSchema;

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

#[macro_export]
macro_rules! range_map {
    ($( $begin: expr , $end: expr => $value: expr ),*) => {{
         let mut map: RangeMap<$crate::rangemap_utils::Float, String> = ::rangemap::RangeMap::new();
         $( map.insert(($begin.into()..$end.into()), $value.into()); )*
         map
    }}
}

pub fn clip_range_map<T: Eq + Clone>(
    range_map: &RangeMap<Float, T>,
    clip_range: Range<Float>,
) -> RangeMap<Float, T> {
    let mut res = RangeMap::new();
    for (range, value) in range_map.overlapping(&clip_range) {
        let range = range.start.max(clip_range.start)..range.end.min(clip_range.end);
        res.insert(range, value.clone());
    }
    res
}

pub enum Direction {
    StartToEnd,
    EndToStart,
}

// Transforms a range map as though it was traveled from point `entry` in the given direction.
pub fn shift_range_map<T: Eq + Clone>(
    track_range_map: &RangeMap<Float, T>,
    entry: f64,
    direction: Direction,
) -> RangeMap<Float, T> {
    let mut res = RangeMap::new();
    for (range, value) in track_range_map.iter() {
        let (start, end) = match direction {
            Direction::StartToEnd => (range.start.0, range.end.0),
            Direction::EndToStart => (range.end.0, range.start.0),
        };

        let range = (start - entry).abs().into()..(end - entry).abs().into();
        res.insert(range, value.clone());
    }
    res
}

/// Insert a range map in another, at the given offset.
pub fn extend_range_map<T: Eq + Clone>(
    dest_range_map: &mut RangeMap<Float, T>,
    origin_range_map: RangeMap<Float, T>,
    offset: f64,
) {
    for (range, value) in origin_range_map.iter() {
        let range = (range.start.0 + offset).into()..(range.end.0 + offset).into();
        assert!(!dest_range_map.overlaps(&range), "range overlap");
        dest_range_map.insert(range, value.clone());
    }
}

/// A struct to represent range maps in responses
#[derive(Debug, Deserialize, PartialEq, Serialize, ToSchema)]
pub struct RangedValue {
    #[schema(example = 0.0)]
    pub begin: f64,
    #[schema(example = 10.0)]
    pub end: f64,
    #[schema(example = "25000")]
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

    #[test]
    fn test_clip_range_map() {
        let range_map = range_map!(0.0, 10.0 => "a", 10.0, 20.0 => "b", 20.0, 30.0 => "c");

        let clipped = clip_range_map(&range_map, 5.0.into()..20.0.into());
        assert_eq!(clipped, range_map!(5.0, 10.0 => "a", 10.0, 20.0 => "b"));
    }

    #[test]
    fn test_shift_range_map_start_to_stop() {
        let range_map = range_map!(5.0, 10.0 => "a", 10.0, 20.0 => "b", 20.0, 30.0 => "c");

        let traveled = shift_range_map(&range_map, 5.0, Direction::StartToEnd);
        assert_eq!(
            traveled,
            range_map!(0.0, 5.0 => "a", 5.0, 15.0 => "b", 15.0, 25.0 => "c")
        );
    }

    #[test]
    fn test_shift_range_map_stop_to_start() {
        let range_map = range_map!(0.0, 10.0 => "a", 10.0, 22.0 => "b", 22.0, 25.0 => "c");

        let traveled = shift_range_map(&range_map, 25.0, Direction::EndToStart);
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
    fn test_ranged_value_list_from_range_map() {
        let range_map = range_map!(0.0, 10.0 => "a", 10.0, 20.0 => "b", 30.0, 40.0 => "c");

        let expected = vec![
            RangedValue {
                begin: 0.0,
                end: 10.0,
                value: "a".to_string(),
            },
            RangedValue {
                begin: 10.0,
                end: 20.0,
                value: "b".to_string(),
            },
            RangedValue {
                begin: 30.0,
                end: 40.0,
                value: "c".to_string(),
            },
        ];

        assert_eq!(RangedValue::list_from_range_map(&range_map), expected);
    }
}
