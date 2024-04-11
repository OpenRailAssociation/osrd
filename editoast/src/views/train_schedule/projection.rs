use std::collections::HashMap;

use serde::Deserialize;
use serde::Serialize;

use crate::models::PathfindingPayload;
use crate::schema::DirectionalTrackRange;
use editoast_common::Identifier;

#[derive(Debug, Serialize, Deserialize)]
pub struct Projection {
    pub tracks: HashMap<Identifier, (f64, f64, f64)>,
    pub length: f64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct PathLocation {
    pub track: Identifier,
    pub offset: f64,
    pub path_offset: f64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct PathRange {
    pub begin: PathLocation,
    pub end: PathLocation,
}

impl Projection {
    pub fn new(path_payload: &PathfindingPayload) -> Self {
        let dir_track_ranges = Self::_path_to_tracks(path_payload);
        Self::_init_tracks(dir_track_ranges)
    }

    fn _path_to_tracks(path_payload: &PathfindingPayload) -> Vec<DirectionalTrackRange> {
        let mut tracks = Vec::new();
        for route_path in &path_payload.route_paths {
            tracks.extend(
                route_path
                    .track_ranges
                    .iter()
                    .filter(|track| track.begin != track.end)
                    .cloned(),
            );
        }
        Self::_merge_ranges_same_tracks(tracks)
    }

    fn _merge_ranges_same_tracks(ranges: Vec<DirectionalTrackRange>) -> Vec<DirectionalTrackRange> {
        if ranges.is_empty() {
            return ranges;
        }
        let mut res = vec![ranges[0].clone()];
        for r in ranges[1..].iter() {
            if res.last().unwrap().track != r.track {
                res.push(r.clone());
                continue;
            }
            assert_eq!(res.last().unwrap().direction, r.direction);
            assert!(
                (res.last().unwrap().begin - r.end).abs() * 1000.0 < 1.0
                    || (res.last().unwrap().end - r.begin).abs() * 1000.0 < 1.0
            );
            res.last_mut().unwrap().begin = res.last().unwrap().begin.min(r.begin);
            res.last_mut().unwrap().end = res.last().unwrap().end.max(r.end);
        }
        res
    }

    fn _init_tracks(dir_track_ranges: Vec<DirectionalTrackRange>) -> Self {
        let mut tracks = HashMap::new();
        let mut length = 0.0;
        let mut offset = 0.0;
        for dir_track_range in dir_track_ranges {
            let begin = dir_track_range.get_begin();
            let end = dir_track_range.get_end();
            length += (end - begin).abs();
            let track_id = dir_track_range.track;
            if tracks.contains_key(&track_id) {
                let (p_begin, _, p_offset) = *tracks.get(&track_id).unwrap();
                tracks.insert(track_id, (p_begin, end, p_offset));
                offset += (end - begin).abs();
                continue;
            }
            tracks.insert(track_id, (begin, end, offset));
            offset += (end - begin).abs();
        }
        Self { tracks, length }
    }

    /// Returns the position projected in the path.
    /// If the tracksection position isn"t contained in the path then return `None`.
    pub fn track_position(&self, track_id: &Identifier, pos: f64) -> Option<f64> {
        if !self.tracks.contains_key(track_id) {
            return None;
        }
        let (begin, end, offset) = *self.tracks.get(track_id).unwrap();
        if (pos < begin && pos < end) || (pos > begin && pos > end) {
            if (pos - begin).abs() < 1e-8 {
                return Some(offset);
            }
            if (pos - end).abs() < 1e-8 {
                return Some(offset + (end - begin).abs());
            }
            return None;
        }
        Some((pos - begin).abs() + offset)
    }

    /// Intersect a given path to the projected path and return a list of PathRange
    pub fn intersect(&self, path_payload: &PathfindingPayload) -> Vec<PathRange> {
        let mut intersections = Vec::new();
        let mut range_begin = None;
        let mut path_offset;
        let mut next_path_offset = 0.0;
        let dir_track_ranges = Self::_path_to_tracks(path_payload);
        for (index, dir_track_range) in dir_track_ranges.iter().enumerate() {
            let track_id = &dir_track_range.track;
            let a_begin = dir_track_range.get_begin();
            let a_end = dir_track_range.get_end();
            let a_length = (a_begin - a_end).abs();
            path_offset = next_path_offset;
            next_path_offset += a_length;

            // Check if there is no intersections
            if !self.tracks.contains_key(track_id) {
                assert!(range_begin.is_none());
                continue;
            }
            let (b_begin, b_end, _) = self.tracks.get(track_id).unwrap();
            let (b_begin, b_end) = (b_begin.min(*b_end), b_begin.max(*b_end));
            if a_begin.min(a_end) >= b_end || a_begin.max(a_end) <= b_begin {
                assert!(range_begin.is_none());
                continue;
            }

            // New intersection, creation of the begin location
            if range_begin.is_none() {
                let mut new_range_begin = PathLocation {
                    track: track_id.clone(),
                    offset: a_begin,
                    path_offset,
                };
                if a_begin < b_begin {
                    new_range_begin.offset = b_begin;
                    new_range_begin.path_offset += b_begin - a_begin;
                } else if a_begin > b_end {
                    new_range_begin.offset = b_end;
                    new_range_begin.path_offset += a_begin - b_end;
                }
                range_begin = Some(new_range_begin)
            }

            // Check end of intersection, if so we add it to the list
            if index + 1 >= dir_track_ranges.len()
                || !self.tracks.contains_key(&dir_track_ranges[index + 1].track)
            {
                let mut range_end = PathLocation {
                    track: track_id.clone(),
                    offset: a_end,
                    path_offset: next_path_offset,
                };
                if a_end < b_begin {
                    range_end.offset = b_begin;
                    range_end.path_offset -= b_begin - a_end;
                } else if a_end > b_end {
                    range_end.offset = b_end;
                    range_end.path_offset -= a_end - b_end;
                }
                intersections.push(PathRange {
                    begin: range_begin.unwrap(),
                    end: range_end,
                });
                range_begin = None;
            }
        }
        intersections
    }
}

#[cfg(test)]
pub mod tests {
    use rstest::fixture;

    use super::*;
    use crate::models::RoutePath;
    use editoast_schemas::infra::Direction;

    #[test]
    fn test_intersect() {
        let path = PathfindingPayload {
            route_paths: vec![
                RoutePath {
                    route: "rt.buffer_stop.1->DA0".to_string(),
                    track_ranges: vec![DirectionalTrackRange::new(
                        "TA1",
                        865.693344452354,
                        1770.0,
                        Direction::StartToStop,
                    )],
                    signaling_type: "BAL3".to_string(),
                },
                RoutePath {
                    route: "rt.DA0->DA6_1".to_string(),
                    track_ranges: vec![
                        DirectionalTrackRange::new("TA1", 1770.0, 1950.0, Direction::StartToStop),
                        DirectionalTrackRange::new("TA3", 0.0, 50.0, Direction::StartToStop),
                        DirectionalTrackRange::new("TA6", 0.0, 1800.0, Direction::StartToStop),
                    ],
                    signaling_type: "BAL3".to_string(),
                },
                RoutePath {
                    route: "rt.DA6_1->DA6_2".to_string(),
                    track_ranges: vec![DirectionalTrackRange::new(
                        "TA6",
                        1800.0,
                        2364.644651419894,
                        Direction::StartToStop,
                    )],
                    signaling_type: "BAL3".to_string(),
                },
            ],
            path_waypoints: vec![], // Not used here
        };

        let projection = Projection {
            tracks: HashMap::from([
                (
                    Identifier("TA0".to_string()),
                    (624.217503450338, 2000.0, 0.0),
                ),
                (
                    Identifier("TA6".to_string()),
                    (0.0, 2364.644651419894, 1375.782496549662),
                ),
            ]),
            length: 3740.4271479695562,
        };

        let expected = vec![PathRange {
            begin: PathLocation {
                track: Identifier("TA6".to_string()),
                offset: 0.0,
                path_offset: 1134.306655547646,
            },
            end: PathLocation {
                track: Identifier("TA6".to_string()),
                offset: 2364.644651419894,
                path_offset: 3498.9513069675404,
            },
        }];

        let res = projection.intersect(&path);

        assert_eq!(res, expected);
    }

    #[fixture]
    fn first_route() -> RoutePath {
        RoutePath {
            route: "route_1".to_string(),
            track_ranges: vec![
                DirectionalTrackRange::new("track_1", 100.0, 1000.0, Direction::StartToStop),
                DirectionalTrackRange::new("track_2", 0.0, 500.0, Direction::StartToStop),
            ],
            signaling_type: "BAL3".to_string(),
        }
    }

    #[fixture]
    fn second_route() -> RoutePath {
        RoutePath {
            route: "route_2".to_string(),
            track_ranges: vec![
                DirectionalTrackRange::new("track_2", 500.0, 1000.0, Direction::StartToStop),
                DirectionalTrackRange::new("track_3", 500.0, 1000.0, Direction::StopToStart),
                DirectionalTrackRange::new("track_3", 0.0, 500.0, Direction::StopToStart),
            ],
            signaling_type: "BAL3".to_string(),
        }
    }

    #[fixture]
    fn third_route() -> RoutePath {
        RoutePath {
            route: "route_2".to_string(),
            track_ranges: vec![
                DirectionalTrackRange::new("track_3", 500.0, 1000.0, Direction::StopToStart),
                DirectionalTrackRange::new("track_3", 0.0, 500.0, Direction::StopToStart),
            ],
            signaling_type: "BAL3".to_string(),
        }
    }

    #[fixture]
    fn simple_path_payload(first_route: RoutePath, second_route: RoutePath) -> PathfindingPayload {
        PathfindingPayload {
            route_paths: vec![first_route, second_route],
            path_waypoints: vec![],
        }
    }

    #[fixture]
    fn simple_projection(simple_path_payload: PathfindingPayload) -> Projection {
        Projection::new(&simple_path_payload)
    }

    #[rstest::rstest]
    fn test_project_path_on_itself(simple_path_payload: PathfindingPayload) {
        let projection = Projection::new(&simple_path_payload);
        let res = projection.intersect(&simple_path_payload);
        assert_eq!(res.len(), 1);
        assert_eq!(res[0].begin.path_offset, 0.0);
        assert_eq!(res[0].end.path_offset, projection.length);
    }

    #[rstest::rstest]
    fn test_project_first_route(simple_path_payload: PathfindingPayload) {
        let projection = Projection::new(&simple_path_payload);
        let res = projection.intersect(&PathfindingPayload {
            route_paths: vec![first_route()],
            path_waypoints: vec![],
        });
        assert_eq!(res.len(), 1);
        assert_eq!(res[0].begin.path_offset, 0.0);
        assert_eq!(res[0].end.path_offset, 1400.0);
        assert_eq!(res[0].end.offset, 500.0);
        assert_eq!(res[0].end.track, Identifier("track_2".to_string()));
    }

    #[rstest::rstest]
    fn test_project_second_route(
        second_route: RoutePath,
        simple_path_payload: PathfindingPayload,
        simple_projection: Projection,
    ) {
        let projection = Projection::new(&simple_path_payload);
        let res = projection.intersect(&PathfindingPayload {
            route_paths: vec![second_route],
            path_waypoints: vec![],
        });
        assert_eq!(res.len(), 1);
        assert_eq!(res[0].begin.path_offset, 0.0);
        assert_eq!(res[0].end.path_offset, simple_projection.length - 1400.0);
        assert_eq!(res[0].begin.offset, 500.0);
        assert_eq!(res[0].begin.track, Identifier("track_2".to_string()));
    }

    #[rstest::rstest]
    fn test_long_path_on_short_projection(first_route: RoutePath, second_route: RoutePath) {
        let projection = Projection::new(&PathfindingPayload {
            route_paths: vec![first_route.clone()],
            path_waypoints: vec![],
        });
        let res = projection.intersect(&PathfindingPayload {
            route_paths: vec![first_route, second_route],
            path_waypoints: vec![],
        });
        assert_eq!(res.len(), 1);
        assert_eq!(res[0].begin.path_offset, 0.0);
        assert_eq!(res[0].end.path_offset, projection.length);
        assert_eq!(res[0].end.offset, 500.0);
        assert_eq!(res[0].end.track, Identifier("track_2".to_string()));
    }

    #[rstest::rstest]
    fn test_long_path_on_short_projection_inverted(
        first_route: RoutePath,
        second_route: RoutePath,
        simple_projection: Projection,
    ) {
        let projection = Projection::new(&PathfindingPayload {
            route_paths: vec![second_route.clone()],
            path_waypoints: vec![],
        });
        let res = projection.intersect(&PathfindingPayload {
            route_paths: vec![first_route, second_route],
            path_waypoints: vec![],
        });
        assert_eq!(res.len(), 1);
        assert_eq!(res[0].begin.path_offset, 1400.0);
        assert_eq!(res[0].end.path_offset, simple_projection.length);
        assert_eq!(res[0].begin.offset, 500.0);
        assert_eq!(res[0].begin.track, Identifier("track_2".to_string()));
    }

    #[rstest::rstest]
    fn test_no_intersection(first_route: RoutePath, third_route: RoutePath) {
        let projection = Projection::new(&PathfindingPayload {
            route_paths: vec![first_route],
            path_waypoints: vec![],
        });
        let res = projection.intersect(&PathfindingPayload {
            route_paths: vec![third_route],
            path_waypoints: vec![],
        });
        assert_eq!(res.len(), 0);
    }
}
