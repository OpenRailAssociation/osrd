use std::collections::HashMap;

use editoast_common::rangemap_utils::clip_range_map;
use editoast_common::rangemap_utils::extend_range_map;
use editoast_common::rangemap_utils::shift_range_map;
use editoast_common::rangemap_utils::Float;
use rangemap::RangeMap;

use crate::models::pathfinding::Pathfinding;
use editoast_schemas::infra::Direction;

/// A map of track IDs to range maps
pub type TrackMap<T> = HashMap<String, RangeMap<Float, T>>;

pub fn make_path_range_map<T: Eq + Clone>(
    value_maps_by_track: &TrackMap<T>,
    pathfinding: &Pathfinding,
) -> RangeMap<Float, T> {
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
            let value_map = shift_range_map(&value_map, range_entry, track_range.direction.into());
            extend_range_map(&mut res, value_map, offset);
        }
        offset += track_range.end - track_range.begin;
    }

    res
}

#[cfg(test)]
mod tests {
    use editoast_common::range_map;

    use super::*;
    use crate::modelsv2::fixtures::simple_pathfinding_v1;

    #[test]
    fn test_make_path_range_map() {
        let pathfinding = simple_pathfinding_v1(0);
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
