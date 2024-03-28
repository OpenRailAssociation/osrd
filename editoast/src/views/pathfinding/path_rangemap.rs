use std::collections::HashMap;

use osrd_containers::rangemap_utils::clip_range_map;
use osrd_containers::rangemap_utils::extend_range_map;
use osrd_containers::rangemap_utils::travel_range_map;
use osrd_containers::rangemap_utils::Float;
use osrd_containers::rangemap_utils::TravelDir;
use rangemap::RangeMap;

use crate::models::pathfinding::Pathfinding;
use crate::schema::Direction;

/// A map of track IDs to range maps
pub type TrackMap<T> = HashMap<String, RangeMap<Float, T>>;

impl From<Direction> for TravelDir {
    fn from(val: Direction) -> TravelDir {
        match val {
            Direction::StartToStop => TravelDir::StartToStop,
            Direction::StopToStart => TravelDir::StopToStart,
        }
    }
}

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
            let value_map = travel_range_map(&value_map, range_entry, track_range.direction.into());
            extend_range_map(&mut res, value_map, offset);
        }
        offset += track_range.end - track_range.begin;
    }

    res
}

#[cfg(test)]
mod tests {
    use osrd_containers::range_map;

    use super::*;
    use crate::models::pathfinding::tests::simple_pathfinding;

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
