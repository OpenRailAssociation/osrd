use editoast_schemas::infra::Direction;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::primitives::Identifier;
use std::collections::HashMap;

use super::TrackRange;

editoast_common::schemas! {
    Intersection,
}

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
        self.path.get(index)
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

    /// Returns a list of intersection ranges on `self` for `track_ranges`.
    ///
    /// Intersection ranges are a pair of start and end positions on the `self` path.
    /// If there is no common track section range, the returned list is empty.
    /// The positions in the intersection list are guaranteed to increase. In other words,
    /// `list[n].0 < list[n].1 <= list[n+1].0 < list[n+1].1`.
    /// These positions can then be use in conjunction with [PathProjection::get_location].
    ///
    /// # Definition
    ///
    /// 'path' is about the track ranges of the `PathProjection` (or `self`)
    /// 'track_ranges' is about the projected track ranges (the argument of the function)
    ///
    /// # Hypothesis
    /// The path is supposed to be continuous and ordered. That means that 2
    /// successive track ranges are linked in the path (there is no hole).
    /// This hypothesis allow us to merge intersections that overlap on 2 (or more)
    /// successive track ranges.
    ///
    /// In the following example:
    /// - the first and second TRACK RANGES are continuous along the PATH: the first intersection is
    ///   a merge between the overlap on A and the overlap on B.
    /// - the first and the fourth TRACK RANGES overlap on A, so they're merged too.
    /// - the fifth TRACK RANGE doesn't add anything that is not already covered by the second TRACK RANGE.
    ///
    ///                      A                 B                 C
    ///              150           200 300           250 0               90
    /// PATH         |---------------| |---------------| |----------------|
    ///
    ///                        A              B                   C
    ///                    180     200 300        270        40       70
    /// TRACK RANGES       |----1----| |------2-----|        |----3----|
    ///                 170     190        290 280
    ///                 |----4----|        |--5--|
    ///
    /// EVENTS          B  B      E  E B   B     E  E       B         E
    /// (offsets)       20 30    40 50 50  60   70 80       140     170
    /// (depth)         +1 +2    +1 +0 +1  +2   +1 +0       +1       +0
    ///
    ///                 20                         80       140     170
    /// INTERSECTIONS   |---------------------------|       |---------|
    ///
    /// # Algorithm
    ///
    /// 1. for each track range of the path
    ///   1. we find all the matching track range in `track_ranges`
    ///   2. then we filter out those that do not overlap with the offsets
    ///   3. then for each track range, we create a BEGIN and an END event
    ///     - those events contain the offset from the start of `path`
    ///   4. these events are collected into a vec
    ///   5. the vec of events are ordered by the offset
    ///   6. we extend the global list of events, with the list of event for the current track section
    /// 2. we now have entire list of ordered event
    /// 3. for each event
    ///   - if the event is BEGIN, we remind the offset only if an intersection is not only started (see `depth`)
    ///   - if the event is END, we create a new intersection, only if we don't have another one still opened (see `depth`)
    #[tracing::instrument(level = "trace", skip(self), fields(path = ?self.path, track_ranges = ?track_ranges))]
    pub fn get_intersections(&self, track_ranges: &[TrackRange]) -> Vec<Intersection> {
        #[derive(Debug)]
        enum TrackRangeEvent {
            Begin { offset: u64, is_exhaustive: bool },
            End { offset: u64, is_exhaustive: bool },
        }
        impl TrackRangeEvent {
            fn offset(&self) -> u64 {
                match self {
                    TrackRangeEvent::Begin { offset, .. } | TrackRangeEvent::End { offset, .. } => {
                        *offset
                    }
                }
            }
        }
        // Regroup projected track ranges per identifier (might be more than one per identifier)
        let track_ranges_per_id = track_ranges.iter().fold(
            HashMap::<&Identifier, Vec<&TrackRange>>::new(),
            |mut map, track_range| {
                map.entry(&track_range.track_section)
                    .or_default()
                    .push(track_range);
                map
            },
        );

        let mut track_range_events: Vec<TrackRangeEvent> = vec![];
        let mut current_position: u64 = 0;
        tracing::trace!("creating global list of track range events");
        for path_track_range in self.path {
            let _iter_span = tracing::trace_span!(
                "handling_path_track_range",
                current_position,
                ?path_track_range,
            )
            .entered();
            let mut current_track_range_events: Vec<TrackRangeEvent> = track_ranges_per_id
                .get(&path_track_range.track_section)
                .into_iter()
                .flatten()
                .copied()
                .filter_map(|track_range| {
                    if let Some(Intersection { start, end }) = path_track_range.overlap(track_range)
                    {
                        tracing::trace!(start, end, "overlap");
                        match path_track_range.direction {
                            Direction::StartToStop => Some([
                                // Express as offset from the beginning of 'path_track_range'
                                TrackRangeEvent::Begin {
                                    offset: current_position + (start - path_track_range.begin),
                                    is_exhaustive: start == track_range.begin,
                                },
                                TrackRangeEvent::End {
                                    offset: current_position + (end - path_track_range.begin),
                                    is_exhaustive: end == track_range.end,
                                },
                            ]),
                            Direction::StopToStart => Some([
                                // Express as offset from the end of 'path_track_range'
                                TrackRangeEvent::Begin {
                                    offset: current_position + (path_track_range.end - end),
                                    is_exhaustive: start == track_range.begin,
                                },
                                TrackRangeEvent::End {
                                    offset: current_position + (path_track_range.end - start),
                                    is_exhaustive: end == track_range.end,
                                },
                            ]),
                        }
                    } else {
                        None
                    }
                })
                .flatten()
                .collect();
            current_track_range_events.sort_by_key(TrackRangeEvent::offset);
            tracing::trace!(sorted_track_range_events = ?current_track_range_events);
            track_range_events.extend(current_track_range_events);

            current_position += path_track_range.length();
        }
        tracing::trace!(?track_range_events);
        let mut intersection_start = None;
        let mut depth = 0_usize;
        let mut intersections: Vec<Intersection> = vec![];
        tracing::trace!("creating intersection from track range events");
        for track_range_event in track_range_events {
            let _iter_span = tracing::trace_span!(
                "handling_track_range_event",
                ?track_range_event,
                ?intersection_start,
                ?depth,
                ?intersections,
            )
            .entered();
            match track_range_event {
                TrackRangeEvent::Begin {
                    offset,
                    is_exhaustive,
                } => {
                    if let Some(intersection) = intersections.pop() {
                        // Here, we pop the last intersection to check
                        // if its end has the same offset as the current
                        // offset.
                        // We also want to start a new intersection in case it's a non-bound event
                        if !is_exhaustive || intersection.end != offset {
                            // If no, we push back the intersection, and start
                            // a new one
                            intersections.push(intersection);
                            intersection_start = intersection_start.or(Some(offset));
                        } else {
                            // If yes, we reinitialize `intersect` with the
                            // start of the previous intersection
                            intersection_start = Some(intersection.start);
                        }
                    } else {
                        // No previous intersection, we initialize
                        // `intersect` only if it's the first
                        // begin event
                        assert_eq!(intersection_start.is_none(), depth == 0);
                        // Equivalent to
                        // intersect = intersect.or(Some(offset));
                        if depth == 0 {
                            intersection_start = Some(offset);
                        }
                    }
                    depth += 1;
                }
                TrackRangeEvent::End {
                    offset,
                    is_exhaustive,
                } => {
                    depth -= 1;
                    if let Some(start) = intersection_start.take() {
                        if depth == 0 {
                            // Intersection are already offsets from the beginning of 'self'
                            intersections.push(Intersection::from((start, offset)));
                            intersection_start = None;
                        } else {
                            // If the depth is not 0, then we don't want to create
                            // an intersection yet, so push back the value in `intersect`
                            intersection_start = Some(start);
                        }
                    }
                }
            }
            tracing::trace!(
                ?intersection_start,
                ?depth,
                ?track_range_event,
                ?intersections,
                "end iter"
            );
        }
        intersections
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
    use std::iter::DoubleEndedIterator;

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
    fn projection_get_out_of_bound_location() {
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
    #[case::one_path_one_simple_intersection(&["A+100-200"], &["A+120-140"], &[(20, 40)])]
    #[case::one_path_one_simple_intersection_reverse_on_track_ranges(&["A+100-200"], &["A+140-120"], &[(20, 40)])]
    #[case::one_path_two_disjoint_tracks(&["A+100-200"], &["A+120-140", "A+160-180"], &[(20, 40), (60, 80)])]
    #[case::one_path_over_the_external_bounds(&["A+100-200"], &["A+80-120", "A+180-220"], &[(0, 20), (80, 100)])]
    #[case::one_path_merged(&["A+100-200"], &["A+130-150", "A+150-170"], &[(30, 70)])]
    // Two tracks on the path
    #[case::two_path_merged(&["A+100-200", "B+100-200"], &["A+180-200", "B+100-120"], &[(80, 120)])]
    #[case::two_path_not_merged(&["A+100-200", "B+100-200"], &["A+180-220", "B+80-120"], &[(80, 100), (100, 120)])]
    #[case::two_path_merged_with_extra_bounds(&["A+100-200", "B+100-200"], &["A+180-220", "B+80-120"], &[(80, 120)])]
    // Three tracks on the path
    #[case::three_path_with_hole(&["A+100-200", "B+100-200", "C+100-200"], &["A+150-200", "C+100-150"], &[(50, 100), (200, 250)])]
    // Complex paths with complex track ranges
    #[case::complex_path_one_intersection(
        &["A+0-100", "B+200-0", "C+0-300", "D+250-0", "E+0-100"],
        &["A+50-100", "B+200-0", "C+0-300", "D+250-120"],
        &[(50, 730)]
    )]
    #[case::complex_path_two_intersections(
        &["X+0-100", "B+0-200", "C+200-150", "E+30-100", "Z+0-100"],
        &["A+50-100", "B+200-0", "C+0-300", "D+250-0", "E+100-25"],
        &[(100, 350), (350, 420)]
    )]
    #[case::complex_path_three_intersections(
        &["A+0-100", "B+0-200", "X+0-100", "C+200-150", "Z+0-100", "E+30-100"],
        &["A+50-100", "B+200-0", "C+0-300", "D+250-0", "E+100-25"],
        &[(50, 300), (400, 450), (550, 620)]
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
        let _guard = tracing::dispatcher::set_default(
            &tracing_subscriber::fmt::fmt()
                .pretty()
                .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
                .with_span_events(tracing_subscriber::fmt::format::FmtSpan::ACTIVE)
                .into(),
        );
        let path = path.iter().map(|s| s.parse().unwrap());
        let path = if toggle_path {
            invert_track_ranges(path)
        } else {
            path.collect()
        };
        let path_projection = PathProjection::new(&path);

        let track_ranges = track_ranges.iter().map(|s| s.parse().unwrap());
        let track_ranges = if toggle_track_ranges {
            invert_track_ranges(track_ranges)
        } else {
            track_ranges.collect()
        };
        let expected_intersections = expected_intersections
            .iter()
            .copied()
            .map(Intersection::from);
        let expected_intersections = if toggle_path {
            invert_intersections(expected_intersections, path_projection.length)
        } else {
            expected_intersections.collect()
        };

        let intersections = path_projection.get_intersections(&track_ranges);

        assert_eq!(intersections, expected_intersections);
    }
}
