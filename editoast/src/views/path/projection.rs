use core_client::pathfinding::TrackRange;
use schemas::infra::Direction;
use schemas::infra::TrackOffset;
use schemas::primitives::Identifier;
use std::collections::HashMap;

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
            assert!(
                track_index
                    .insert(&track_range.track_section, index)
                    .is_none()
            );
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
                let mid = (left + right).div_ceil(2);
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
    pub fn get_intersections(&self, track_ranges: &[TrackRange]) -> Vec<Intersection> {
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

/// Represent the intersection between a track range and a path, relative to the beginning of the path
#[derive(Debug, serde::Serialize, serde::Deserialize, PartialEq, utoipa::ToSchema)]
pub struct Intersection {
    /// Distance of the beginning of the intersection relative to the beginning of the path
    start: u64,
    /// Distance of the end of the intersection relative to the beginning of the path
    end: u64,
}
impl From<(u64, u64)> for Intersection {
    fn from((start, end): (u64, u64)) -> Self {
        debug_assert!(
            start <= end,
            "intersection should have a 'start' ({start}) smaller than 'end' ({end})"
        );
        Self { start, end }
    }
}
impl Intersection {
    pub fn start(&self) -> u64 {
        self.start
    }
    pub fn end(&self) -> u64 {
        self.end
    }
}
struct IntersectionBuilder {
    start: Option<u64>,
    current: u64,
    intersections: Vec<Intersection>,
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
            self.intersections
                .push(Intersection::from((start, self.current)));
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
    /// if the requested location exactly lands between two track sections (i.e. a switch).
    Two(TrackOffset, TrackOffset),
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;
    use schemas::infra::DirectionalTrackRange;
    use std::iter::DoubleEndedIterator;

    #[test]
    #[should_panic]
    fn projection_invalid_creation() {
        let path = vec![
            DirectionalTrackRange::new("A", 50., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new(
                "A", // Same track section
                20.,
                200.,
                Direction::StopToStart,
            )
            .into(),
        ];

        PathProjection::new(&path);
    }

    #[rstest]
    #[case("A", 50_000, Some(0))]
    #[case("A", 80_000, Some(30_000))]
    #[case("A", 20_000, None)]
    #[case("A", 101_000, None)]
    #[case("B", 100_000, Some(150_000))]
    #[case("B", 19_000, None)]
    #[case("B", 22_0000, None)]
    #[case("C", 100_000, Some(330_000))]
    #[case("C", 300_000, Some(530_000))]
    #[case("C", 301_000, None)]
    #[case("C", 3_000_000, None)]
    fn projection_odd(#[case] track: &str, #[case] offset: u64, #[case] expected: Option<u64>) {
        let path = vec![
            DirectionalTrackRange::new("A", 50., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 20., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
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
    #[case(50_000, "A", 100_000, "B", 220_000)]
    #[case(250_000, "B", 20_000, "C", 300_000)]
    #[case(550_000, "C", 0, "D", 50_000)]
    #[case(650_000, "D", 150_000, "E", 100_000)]
    fn projection_boundaries(
        #[case] position: u64,
        #[case] track_a: &str,
        #[case] offset_a: u64,
        #[case] track_b: &str,
        #[case] offset_b: u64,
    ) {
        let path = vec![
            DirectionalTrackRange::new("A", 50., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 20., 220., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StopToStart).into(),
            DirectionalTrackRange::new("D", 50., 150., Direction::StartToStop).into(),
            DirectionalTrackRange::new("E", 100., 200., Direction::StartToStop).into(),
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
        let path = vec![DirectionalTrackRange::new("A", 50., 100., Direction::StartToStop).into()];

        let projection = PathProjection::new(&path);

        projection.get_location(51_000);
    }

    #[rstest]
    #[case("A", 50_000, 0)]
    #[case("B", 80_000, 170_000)]
    #[case("C", 20_000, 250_000)]
    #[case("D", 101_000, 779_000)]
    fn projection_even(#[case] track: &str, #[case] offset: u64, #[case] expected: u64) {
        let path = vec![
            DirectionalTrackRange::new("A", 50., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 20., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
            DirectionalTrackRange::new("D", 80., 350., Direction::StopToStart).into(),
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

    // To invert track ranges, we need to get the list of track ranges
    // backwards, and toggle the direction for each track range
    fn invert_track_ranges(
        track_ranges: impl DoubleEndedIterator<Item = TrackRange>,
    ) -> Vec<TrackRange> {
        track_ranges
            .rev()
            .map(|mut track_range| {
                track_range.direction = track_range.direction.toggle();
                track_range
            })
            .collect()
    }

    // To invert the intersection, we need to get the intersection backwards,
    // invert each tuple and change the offsets by subtracting them from
    // the total length of the projection path.
    //
    // For example, let's project "A+120-140" on a path "A+100-200", it will
    // give the intersection (20, 40). If we invert the projection path (from
    // "A+100-200" into "A+200-100"), we then get an intersection (60, 80).
    // This new result can be calculated by:
    // - calculating the length of the projection path: 200 - 100 = 100
    // - inverting the original tuple: (20, 40) -> (40, 20)
    // - subtracting from the length: (100-40, 100-20) = (60, 80)
    fn invert_intersections(
        intersections: impl DoubleEndedIterator<Item = Intersection>,
        path_length: u64,
    ) -> Vec<Intersection> {
        // If 'track_range' is inverted, then offset of intersections are backwards
        intersections
            .into_iter()
            .rev()
            .map(|intersection| {
                Intersection::from((
                    path_length - intersection.end(),
                    path_length - intersection.start(),
                ))
            })
            .collect()
    }

    #[rstest]
    // One track on the path
    #[case::one_path_different_track(&["A+0-100"], &["B+0-100"], &[])]
    #[case::one_path_no_overlap(&["A+0-100"], &["A+100-200"], &[])]
    #[case::one_path_one_simple_intersection(
        &["A+120-140"],
        &["A+100-200"],
        &[(20_000, 40_000)]
    )]
    #[case::one_path_one_simple_intersection_reverse_on_track_ranges(
        &["A+140-120"],
        &["A+100-200"],
        &[(20_000, 40_000)]
    )]
    #[case::two_path_merged(
        &["A+180-200", "B+100-120"],
        &["A+100-200", "B+100-200"],
        &[(80_000, 120_000)]
    )]
    #[case::two_path_not_merged(
        &["A+180-220", "B+80-120"],
        &["A+100-200", "B+100-200"],
        &[(80_000, 120_000)]
    )]
    #[case::two_path_merged_with_extra_bounds(
        &["A+180-220", "B+80-120"],
        &["A+100-200", "B+100-200"],
        &[(80_000, 120_000)]
    )]
    #[case::three_path_with_hole(
        &["A+150-200", "C+100-150"],
        &["A+100-200", "B+100-200", "C+100-200"],
        &[(50_000, 100_000), (200_000, 250_000)]
    )]
    // Complex paths with complex track ranges
    #[case::complex_path_one_intersection(
        &["A+50-100", "B+200-0", "C+0-300", "D+250-120"],
        &["A+0-100", "B+200-0", "C+0-300", "D+250-0", "E+0-100"],
        &[(50_000, 730_000)]
    )]
    #[case::complex_path_two_intersections(
        &["A+50-100", "B+200-0", "C+0-300", "D+250-0", "E+100-25"],
        &["X+0-100", "B+0-200", "C+200-150", "E+30-100", "Z+0-100"],
        &[(100_000, 350_000), (350_000, 420_000)]
    )]
    #[case::complex_path_three_intersections(
        &["A+50-100", "B+200-0", "C+0-300", "D+250-0", "E+100-25"],
        &["A+0-100", "B+0-200", "X+0-100", "C+200-150", "Z+0-100", "E+30-100"],
        &[(50_000, 300_000), (400_000, 450_000), (550_000,620_000)]
    )]
    fn get_intersections(
        #[case] path: &[&str],
        #[case] track_ranges: &[&str],
        #[case] expected_intersections: &[(u64, u64)],
        // If we invert the projected track ranges, it doesn't change the intersection
        #[values(false, true)] toggle_path: bool,
        // If we invert the projection path, the intersections will be backwards
        // and the offsets will be subtracted from the total length
        #[values(false, true)] toggle_track_ranges: bool,
    ) {
        let path = path
            .iter()
            .map(|s| s.parse::<DirectionalTrackRange>().unwrap().into());
        let path = if toggle_path {
            invert_track_ranges(path)
        } else {
            path.collect()
        };
        let projection = PathProjection::new(&path);

        let track_ranges = track_ranges
            .iter()
            .map(|s| s.parse::<DirectionalTrackRange>().unwrap().into());
        let track_ranges = if toggle_track_ranges {
            invert_track_ranges(track_ranges)
        } else {
            track_ranges.collect()
        };
        let expected_intersections = expected_intersections
            .iter()
            .copied()
            .map(Intersection::from);
        let expected_intersections = if toggle_track_ranges {
            let length: u64 = track_ranges.iter().map(TrackRange::length).sum();
            invert_intersections(expected_intersections, length)
        } else {
            expected_intersections.collect()
        };

        let intersections = projection.get_intersections(&track_ranges);

        assert_eq!(intersections, expected_intersections);
    }
}
