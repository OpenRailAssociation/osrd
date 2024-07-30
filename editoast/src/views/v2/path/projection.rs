use editoast_schemas::infra::Direction;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::primitives::Identifier;
use std::collections::HashMap;

use super::TrackRange;

/// This object is useful to:
/// - Get the position in the path given a location (track section and offset).
/// - Get the location (track section and offset) given a position in a path.
#[derive(Debug)]
pub struct PathProjection<'a> {
    /// The path used for projections.
    path: &'a Vec<TrackRange>,
    /// Map track section to their position in the path (in mm).
    map_position: HashMap<&'a Identifier, u64>,
    /// Map track section to their index in the path.
    track_index: HashMap<&'a Identifier, usize>,
    /// The length of the path (in mm).
    length: u64,
}

impl<'a> PathProjection<'a> {
    /// Retrieve a track range from the path given the track section identifier.
    fn get_track_range(&self, track_section: &Identifier) -> Option<&TrackRange> {
        let index = *self.track_index.get(track_section)?;
        Some(&self.path[index])
    }

    /// Create a new projection from a path.
    ///
    /// # Panics
    ///
    /// Panics if the path contains multiple times the same track section.
    pub fn new(path: &'a Vec<TrackRange>) -> Self {
        let mut track_index = HashMap::new();
        let mut map_position = HashMap::new();
        let mut pos: u64 = 0;
        for (index, track_range) in path.iter().enumerate() {
            assert!(track_index
                .insert(&track_range.track_section, index)
                .is_none());
            map_position.insert(&track_range.track_section, pos);
            pos += track_range.length();
        }
        Self {
            path,
            map_position,
            track_index,
            length: pos,
        }
    }

    /// Get the position in the path given a location (track section and offset).
    pub fn get_position(&self, location: &TrackOffset) -> Option<u64> {
        let base_position = *self.map_position.get(&location.track)?;
        let track_range = self
            .get_track_range(&location.track)
            .expect("Track range should be found since we found the base_position");
        // Check if the offset is in the range.
        if location.offset < track_range.begin || location.offset > track_range.end {
            return None;
        }
        if track_range.direction == Direction::StartToStop {
            Some(base_position + location.offset - track_range.begin)
        } else {
            Some(base_position + track_range.end - location.offset)
        }
    }

    /// Get the location (track section and offset) given a position in a path.
    /// This function uses a binary search to find the track section and offset.
    ///
    /// # Panics
    ///
    /// Panics if the position is out of bounds.
    pub fn get_location(&self, position: u64) -> TrackLocationFromPath {
        assert!(position <= self.length, "Position out of bounds");

        // Binary search to retrieve the corresponding track section range.
        let track_section_range_index = {
            let mut left = 0;
            let mut right = self.path.len() - 1;
            while left != right {
                let mid = (left + right + 1) / 2;
                let mid_track_range = &self.path[mid];
                let mid_position = self.map_position[&mid_track_range.track_section];
                if mid_position > position {
                    right = mid - 1;
                } else {
                    left = mid;
                }
            }
            left
        };

        // Retrieve the first location and check if it's on another one
        let index = track_section_range_index;
        let found_track_range = &self.path[index];
        let found_position = self.map_position[&found_track_range.track_section];
        let mut has_next = false;
        let mut has_prev = false;
        let first_track_loc = {
            let track_range_offset = found_track_range.offset(position - found_position);
            if track_range_offset.offset == 0 && index > 0 {
                has_prev = true;
            } else if track_range_offset.offset == found_track_range.length()
                && index < self.path.len() - 1
            {
                has_next = true;
            }
            track_range_offset.as_track_offset()
        };

        // Position on a single location
        if !has_prev && !has_next {
            return TrackLocationFromPath::One(first_track_loc);
        }

        // Position between two locations
        let second_track_loc = if has_next {
            let track_range = &self.path[index + 1];
            TrackOffset::new(&track_range.track_section, track_range.start())
        } else {
            let track_range = &self.path[index - 1];
            TrackOffset::new(&track_range.track_section, track_range.stop())
        };
        TrackLocationFromPath::Two(first_track_loc, second_track_loc)
    }

    /// Returns a list of intersection ranges between `track_ranges` and `self`
    ///
    /// Intersection ranges are a pair of start and end positions on the `track_ranges` path.
    /// If there is no common track section range, the returned list is empty.
    /// The positions in the intersection list are guaranteed to increase. In other words `list[n].0 < list[n].1 <= list[n+1].0 < list[n+1].1`
    /// These positions can then be use in conjunction with [PathProjection::get_location].
    pub fn get_intersections(&self, track_ranges: &[TrackRange]) -> Vec<(u64, u64)> {
        // Handle the length computation in mm
        let mut next_pos: u64 = 0;
        let mut current_pos: u64;

        // Memorize the index of a track section in a path
        let mut path_track_index: usize = 0;
        let mut intersection_builder = IntersectionBuilder::new();

        for track_range in track_ranges {
            // Handle current position
            current_pos = next_pos;
            next_pos += track_range.length();

            // When a track is not part of self
            let Some(proj_track_range) = self.get_track_range(&track_range.track_section) else {
                // then we finish the computation of the current intersection
                intersection_builder.finish();
                continue;
            };

            // When a previous `track_range` (from maybe several iterations ago) left the `self` path,
            // but the current `track_range` is back on it, then `dist > 1` which indicates a discontinuity in the resulting intersection list.
            // So we need to close the previous intersection (if there is one => `start_intersection.is_some()`).
            let current_path_index = *self
                .track_index
                .get(&proj_track_range.track_section)
                .unwrap();

            let dist = ((current_path_index as i64) - (path_track_index as i64)).abs();
            if dist != 1 {
                intersection_builder.finish();
            }

            path_track_index = current_path_index;

            // Compute the intersection
            let offset_begin = track_range.begin.max(proj_track_range.begin);
            let offset_end = track_range.end.min(proj_track_range.end);
            // Check that ranges intersect even if on the same track
            if offset_begin >= offset_end {
                intersection_builder.finish();
                continue;
            }

            // Starting a new intersection
            if intersection_builder.start.is_none() {
                if track_range.direction == Direction::StartToStop {
                    intersection_builder
                        .start_new_intersection(current_pos + offset_begin - track_range.begin)
                } else {
                    intersection_builder
                        .start_new_intersection(current_pos + track_range.end - offset_end)
                }
            }

            // Keeping track of a end of intersection
            intersection_builder.grow_intersection(offset_end - offset_begin);
        }

        // Adding the last intersection
        intersection_builder.finish();

        intersection_builder.intersections
    }

    /// Returns the length of the path in mm
    pub fn len(&self) -> u64 {
        self.length
    }
}

struct IntersectionBuilder {
    start: Option<u64>,
    current: u64,
    intersections: Vec<(u64, u64)>,
}

impl IntersectionBuilder {
    fn new() -> Self {
        Self {
            start: None,
            current: 0,
            intersections: vec![],
        }
    }

    fn finish(&mut self) {
        if let Some(start) = self.start {
            assert_ne!(start, self.current);
            self.intersections.push((start, self.current));
        }
        self.start = None;
    }

    fn start_new_intersection(&mut self, start_pos: u64) {
        assert!(self.start.is_none());
        if self.start.is_none() {
            self.start = Some(start_pos);
            self.current = start_pos;
        }
    }

    fn grow_intersection(&mut self, amount: u64) {
        self.current += amount;
    }
}

/// Represent a location from a position in the path
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrackLocationFromPath {
    /// Used when a position is not at the beginning or at the end of a path
    One(TrackOffset),
    /// Used when a position is at the beginning or at the end of a path
    /// The two locations correspond to 2 extremities of 2 track sections on which the desired position is located
    /// This variant might be returned by [PathProjection::get_location]
    /// if the requested location exactly lands between two track sections (i.e. a track_node).
    Two(TrackOffset, TrackOffset),
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    #[test]
    #[should_panic]
    fn projection_invalid_creation() {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new(
                "A", // Same track section
                20,
                200,
                Direction::StopToStart,
            ),
        ];

        PathProjection::new(&path);
    }

    #[rstest]
    #[case("A", 50, Some(0))]
    #[case("A", 80, Some(30))]
    #[case("A", 20, None)]
    #[case("A", 101, None)]
    #[case("B", 100, Some(150))]
    #[case("B", 19, None)]
    #[case("B", 220, None)]
    #[case("C", 100, Some(330))]
    #[case("C", 300, Some(530))]
    #[case("C", 301, None)]
    #[case("C", 3000, None)]
    fn projection_odd(#[case] track: &str, #[case] offset: u64, #[case] expected: Option<u64>) {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new("B", 20, 200, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StartToStop),
        ];

        let projection = PathProjection::new(&path);

        let location = TrackOffset::new(track, offset);
        let position = projection.get_position(&location);
        assert_eq!(position, expected);

        if let Some(position) = position {
            assert_eq!(
                projection.get_location(position),
                TrackLocationFromPath::One(location)
            );
        }
    }

    #[rstest]
    #[case(50, "A", 100, "B", 220)]
    #[case(250, "B", 20, "C", 300)]
    #[case(550, "C", 0, "D", 50)]
    #[case(650, "D", 150, "E", 100)]
    fn projection_boundaries(
        #[case] position: u64,
        #[case] track_a: &str,
        #[case] offset_a: u64,
        #[case] track_b: &str,
        #[case] offset_b: u64,
    ) {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new("B", 20, 220, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StopToStart),
            TrackRange::new("D", 50, 150, Direction::StartToStop),
            TrackRange::new("E", 100, 200, Direction::StartToStop),
        ];
        let projection = PathProjection::new(&path);

        let loc_a = TrackOffset::new(track_a, offset_a);
        let loc_b = TrackOffset::new(track_b, offset_b);
        assert_eq!(projection.get_position(&loc_a), Some(position));
        assert_eq!(projection.get_position(&loc_b), Some(position));

        let TrackLocationFromPath::Two(res_loc_a, res_loc_b) = projection.get_location(position)
        else {
            panic!("Expected two locations");
        };
        assert!(loc_a == res_loc_a || loc_a == res_loc_b);
        assert!(loc_b == res_loc_a || loc_b == res_loc_b);
        assert_ne!(res_loc_a, res_loc_b);
    }

    #[test]
    #[should_panic]
    fn projection_get_invalid_location() {
        let path = vec![TrackRange::new("A", 50, 100, Direction::StartToStop)];

        let projection = PathProjection::new(&path);

        projection.get_location(51);
    }

    #[rstest]
    #[case("A", 50, 0)]
    #[case("B", 80, 170)]
    #[case("C", 20, 250)]
    #[case("D", 101, 779)]
    fn projection_even(#[case] track: &str, #[case] offset: u64, #[case] expected: u64) {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new("B", 20, 200, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StartToStop),
            TrackRange::new("D", 80, 350, Direction::StopToStart),
        ];

        let projection = PathProjection::new(&path);

        let location = TrackOffset::new(track, offset);
        let position = projection.get_position(&location).unwrap();
        assert_eq!(position, expected);
        assert_eq!(
            projection.get_location(position),
            TrackLocationFromPath::One(location)
        );
    }

    #[test]
    fn get_boundaries_case_1() {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new("B", 0, 200, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StartToStop),
            TrackRange::new("D", 120, 250, Direction::StopToStart),
        ];
        let projection = PathProjection::new(&path);

        let track_ranges = vec![
            TrackRange::new("A", 0, 100, Direction::StartToStop),
            TrackRange::new("B", 0, 200, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StartToStop),
            TrackRange::new("D", 0, 250, Direction::StopToStart),
            TrackRange::new("E", 0, 100, Direction::StartToStop),
        ];

        let boundaries = projection.get_intersections(&track_ranges);
        let expected: Vec<(u64, u64)> = vec![(50, 730)];

        assert_eq!(boundaries, expected);
    }

    #[test]
    fn get_boundaries_case_2() {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new("B", 0, 200, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StartToStop),
            TrackRange::new("D", 0, 250, Direction::StopToStart),
            TrackRange::new("E", 25, 100, Direction::StopToStart),
        ];
        let projection = PathProjection::new(&path);

        let track_ranges = vec![
            TrackRange::new("X", 0, 100, Direction::StartToStop),
            TrackRange::new("B", 0, 200, Direction::StartToStop),
            TrackRange::new("C", 150, 200, Direction::StopToStart),
            TrackRange::new("E", 30, 100, Direction::StartToStop),
            TrackRange::new("Z", 0, 100, Direction::StartToStop),
        ];

        let boundaries = projection.get_intersections(&track_ranges);
        let expected: Vec<(u64, u64)> = vec![(100, 350), (350, 420)];

        assert_eq!(boundaries, expected);
    }

    #[test]
    fn get_boundaries_case_3() {
        let path = vec![
            TrackRange::new("A", 50, 100, Direction::StartToStop),
            TrackRange::new("B", 0, 200, Direction::StopToStart),
            TrackRange::new("C", 0, 300, Direction::StartToStop),
            TrackRange::new("D", 0, 250, Direction::StopToStart),
            TrackRange::new("E", 25, 100, Direction::StopToStart),
        ];
        let projection = PathProjection::new(&path);

        let track_ranges = vec![
            TrackRange::new("A", 0, 100, Direction::StartToStop),
            TrackRange::new("B", 0, 200, Direction::StartToStop),
            TrackRange::new("X", 0, 100, Direction::StartToStop),
            TrackRange::new("C", 150, 200, Direction::StopToStart),
            TrackRange::new("Z", 0, 100, Direction::StartToStop),
            TrackRange::new("E", 30, 100, Direction::StartToStop),
        ];

        let boundaries = projection.get_intersections(&track_ranges);
        let expected: Vec<(u64, u64)> = vec![(50, 300), (400, 450), (550, 620)];

        assert_eq!(boundaries, expected);
    }

    #[test]
    fn get_boundaries_case_4() {
        let path = vec![TrackRange::new("A", 0, 100, Direction::StartToStop)];
        let projection = PathProjection::new(&path);

        let track_ranges = vec![TrackRange::new("B", 0, 100, Direction::StartToStop)];

        let boundaries = projection.get_intersections(&track_ranges);

        let expected: Vec<(u64, u64)> = vec![];
        assert_eq!(boundaries, expected);
    }

    #[test]
    fn get_boundaries_case_5() {
        let path = vec![TrackRange::new("A", 0, 100, Direction::StartToStop)];
        let projection = PathProjection::new(&path);

        let track_ranges = vec![TrackRange::new("A", 100, 200, Direction::StartToStop)];

        let boundaries = projection.get_intersections(&track_ranges);

        let expected: Vec<(u64, u64)> = vec![];
        assert_eq!(boundaries, expected);
    }
}
