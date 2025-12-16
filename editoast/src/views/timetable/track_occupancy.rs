use chrono::Duration;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::simulation::CompleteReportTrain;
use schemas::infra::TrackOffset;
use schemas::primitives::TimeWindow;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::ScheduleItem;

use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::projection::find_index_upper;
use crate::views::projection::linear_interpolate;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;

#[derive(Debug, Clone)]
pub(super) struct TrackOccupancy {
    pub(super) track_section: String,
    pub(super) time_window: TimeWindow,
}

/// Structure holding extracted data needed for track occupancy computation
struct OccupancyContext<'a> {
    final_output: Option<&'a CompleteReportTrain>,
    pathfinding_success: Option<&'a PathfindingResultSuccess>,
    matching_index: Option<usize>,
    schedule_item: Option<&'a ScheduleItem>,
}

/// Search for the index of the first matching path item for an operational point in a given path
fn find_matching_path_item_index(
    path_items: &[PathItem],
    operational_point_id: &str,
    path_item_cache: &PathItemCache,
) -> Option<usize> {
    path_items.iter().position(|path_item| {
        let PathItemLocation::OperationalPointPartReference(op_ref) = &path_item.location else {
            return false;
        };

        path_item_cache
            .get_op_ref_id(&op_ref.operational_point)
            .is_some_and(|id| id == operational_point_id)
    })
}

/// Extracts all context needed for track occupancy computation
fn extract_occupancy_context<'a>(
    operational_point_id: &str,
    path_item_cache: &PathItemCache,
    simulation: &'a simulation::Response,
    pathfinding: &'a PathfindingResult,
    train_schedule: &'a schemas::TrainSchedule,
) -> OccupancyContext<'a> {
    let final_output = match simulation {
        simulation::Response::Success(SimulationResponseSuccess { final_output, .. }) => {
            Some(final_output)
        }
        _ => None,
    };

    let pathfinding_success = match pathfinding {
        PathfindingResult::Success(pathfinding_success) => Some(pathfinding_success),
        _ => None,
    };

    let matching_index =
        find_matching_path_item_index(&train_schedule.path, operational_point_id, path_item_cache);

    let schedule_item = matching_index.and_then(|idx| {
        train_schedule
            .schedule
            .iter()
            .find(|schedule| schedule.at.0 == train_schedule.path[idx].id.0)
    });

    OccupancyContext {
        final_output,
        pathfinding_success,
        matching_index,
        schedule_item,
    }
}

/// Interpolates the arrival time at a given position using simulation output.
fn interpolate_arrival_time(position: u64, final_output: &CompleteReportTrain) -> i64 {
    let index = find_index_upper(&final_output.report_train.positions, position);
    let time = if index == 0 {
        final_output.report_train.times[0]
    } else {
        linear_interpolate(
            final_output.report_train.positions[index - 1],
            final_output.report_train.positions[index],
            final_output.report_train.times[index - 1],
            final_output.report_train.times[index],
            position,
        )
    };
    time as i64
}

// Returns the arrival time for an operational point, using direct match or interpolation.
fn get_arrival_time(
    context: &OccupancyContext,
    operational_point_track_offsets: &[TrackOffset],
) -> Option<i64> {
    if let Some(idx) = context.matching_index {
        return (idx == 0)
            .then_some(0)
            .or_else(|| {
                context
                    .final_output
                    .map(|output| output.report_train.path_item_times[idx] as i64)
            })
            .or_else(|| {
                context
                    .schedule_item
                    .and_then(|s| s.arrival.as_ref())
                    .map(|a| a.num_milliseconds())
            });
    }
    if let (Some(final_output), Some(pathfinding_success)) =
        (context.final_output, context.pathfinding_success)
    {
        let path_projection = PathProjection::new(&pathfinding_success.path.track_section_ranges);
        return operational_point_track_offsets
            .iter()
            .find_map(|track_offset| {
                path_projection
                    .get_position(track_offset)
                    .map(|position| interpolate_arrival_time(position, final_output))
            });
    }
    None
}

// Returns the track section for an operational point, using pathfinding or input.
fn get_track_section(
    context: &OccupancyContext,
    operational_point_track_offsets: &[TrackOffset],
    path_item_cache: &PathItemCache,
    train_schedule: &schemas::TrainSchedule,
) -> Option<String> {
    if let Some(pathfinding_success) = context.pathfinding_success {
        let path_projection = PathProjection::new(&pathfinding_success.path.track_section_ranges);
        return operational_point_track_offsets
            .iter()
            .find(|to| path_projection.get_position(to).is_some())
            .map(|to| to.track.to_string());
    }
    if let Some(idx) = context.matching_index {
        let track_reference = match &train_schedule.path[idx].location {
            PathItemLocation::OperationalPointPartReference(op_ref) => &op_ref.track_reference,
            PathItemLocation::TrackOffset(_) => {
                panic!("matching_index must reference an OperationalPointPartReference")
            }
        };
        if track_reference.is_some() {
            return path_item_cache
                .track_reference_filter(
                    operational_point_track_offsets.to_vec(),
                    track_reference.as_ref(),
                )
                .first()
                .map(|to| to.track.to_string());
        }
    }
    None
}

/// Find track occupancies for a train at an operational point
/// This is a generic function used by both train_schedule and paced_train modules
pub fn find_track_occupancy_for_operational_point(
    operational_point_id: &str,
    operational_point_track_offsets: &[TrackOffset],
    path_item_cache: &PathItemCache,
    simulation: &simulation::Response,
    pathfinding: &PathfindingResult,
    train_schedule: &schemas::TrainSchedule,
) -> Vec<TrackOccupancy> {
    let context = extract_occupancy_context(
        operational_point_id,
        path_item_cache,
        simulation,
        pathfinding,
        train_schedule,
    );

    let arrival_time = match get_arrival_time(&context, operational_point_track_offsets) {
        Some(time) => time,
        None => return vec![],
    };

    let stop_duration = context
        .schedule_item
        .and_then(|item| item.stop_for)
        .unwrap_or_default();

    if let Some(track_section) = get_track_section(
        &context,
        operational_point_track_offsets,
        path_item_cache,
        train_schedule,
    ) {
        return vec![TrackOccupancy {
            track_section,
            time_window: TimeWindow {
                time_begin: train_schedule.start_time + Duration::milliseconds(arrival_time),
                duration: stop_duration,
            },
        }];
    }
    vec![]
}

#[cfg(test)]
pub mod tests {
    use crate::error::InternalError;
    use crate::views::path::pathfinding::PathfindingFailure;
    use chrono::DateTime;
    use core_client::pathfinding::PathfindingNotFound;
    use core_client::pathfinding::TrackRange;
    use core_client::simulation::ReportTrain;
    use pretty_assertions::assert_eq;
    use reqwest::StatusCode;
    use rstest::rstest;
    use schemas::infra::Direction;
    use schemas::infra::TrackOffset;
    use schemas::primitives::Identifier;
    use schemas::primitives::PositiveDuration;
    use schemas::train_schedule::OperationalPointPartReference;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::ReceptionSignal;
    use std::collections::HashMap;

    use super::*;

    #[rstest]
    // Normal cases with both simulation and pathfinding
    #[case("op_2", 1000, 300000, true, true, true)]
    // Edge cases: missing simulation or pathfinding
    #[case("op_1", 0, 0, false, true, true)] // op_1 at index 0 works without simulation
    #[case("op_1", 0, 0, false, false, false)] // No pathfinding fails (no track_reference)
    #[case("op_2", 1000, 300000, false, true, false)] // No simulation fails (no arrival_time)
    #[case("op_3", 5000, 200000, false, false, true)] // op_3 works without simulation/pathfinding (explicit arrival + track_reference)
    fn test_find_track_occupancy_with_matching_path_item(
        #[case] op_id: &str,
        #[case] expected_time: u64,
        #[case] expected_stop_duration_ms: i64,
        #[case] has_simulation: bool,
        #[case] has_pathfinding: bool,
        #[case] should_succeed: bool,
    ) {
        // Create test data
        let (track_section, track_offset, path_item_positions) = match op_id {
            "op_1" => (Identifier::from("T1"), 50, vec![50, 100, 150]),
            "op_2" => (Identifier::from("T2"), 75, vec![50, 75, 150]),
            "op_3" => (Identifier::from("T3"), 100, vec![50, 75, 100, 150]),
            _ => (Identifier::from("T1"), 50, vec![50, 100, 150]),
        };

        let track_range = TrackRange {
            track_section: track_section.clone(),
            begin: 0,
            end: 150,
            direction: Direction::StartToStop,
        };
        let track_ranges = vec![track_range];

        let operational_point_track_offsets = vec![TrackOffset {
            track: track_section.clone(),
            offset: track_offset,
        }];

        let report_train = ReportTrain {
            positions: vec![0, 50, 100, 150],
            times: vec![0, expected_time, 2000, 3000],
            speeds: vec![10.0; 4],
            energy_consumption: 0.0,
            path_item_times: vec![0, expected_time, 2000],
        };

        // Create a train schedule with path items and schedule items
        let start_time = DateTime::from_timestamp(1000000000, 0).unwrap();
        let train_schedule = schemas::TrainSchedule {
            start_time,
            path: vec![
                PathItem {
                    id: "path_item_1".into(),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Id {
                                operational_point: "op_1".into(),
                            },
                            track_reference: None,
                        },
                    ),
                },
                PathItem {
                    id: "path_item_2".into(),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Id {
                                operational_point: "op_2".into(),
                            },
                            track_reference: None,
                        },
                    ),
                },
                PathItem {
                    id: "path_item_3".into(),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Id {
                                operational_point: "op_3".into(),
                            },
                            track_reference: Some(schemas::train_schedule::TrackReference::Id {
                                track_id: track_section.clone(),
                            }),
                        },
                    ),
                },
            ],
            schedule: vec![
                ScheduleItem {
                    at: "path_item_2".into(),
                    arrival: None,
                    stop_for: Some(
                        PositiveDuration::try_from(Duration::milliseconds(300000)).unwrap(),
                    ),
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem {
                    at: "path_item_3".into(),
                    arrival: Some(
                        PositiveDuration::try_from(Duration::milliseconds(5000)).unwrap(),
                    ),
                    stop_for: Some(
                        PositiveDuration::try_from(Duration::milliseconds(200000)).unwrap(),
                    ),
                    reception_signal: ReceptionSignal::Open,
                },
            ],
            ..Default::default()
        };

        // Call the function
        let simulation = if has_simulation {
            simulation::Response::Success(SimulationResponseSuccess {
                base: report_train.clone(),
                provisional: report_train.clone(),
                final_output: CompleteReportTrain {
                    report_train,
                    ..Default::default()
                },
                mrsp: Default::default(),
                electrical_profiles: Default::default(),
            })
        } else {
            simulation::Response::SimulationFailed {
                core_error: InternalError {
                    status: StatusCode::INTERNAL_SERVER_ERROR,
                    error_type: "test:simulation_failed".to_string(),
                    context: HashMap::new(),
                    message: "Test error".to_string(),
                },
            }
        };

        let pathfinding = if has_pathfinding {
            PathfindingResult::Success(PathfindingResultSuccess {
                path: core_client::pathfinding::TrainPath {
                    blocks: vec![],
                    routes: vec![],
                    track_section_ranges: track_ranges,
                },
                length: 150,
                path_item_positions,
            })
        } else {
            PathfindingResult::Failure(PathfindingFailure::PathfindingNotFound(
                PathfindingNotFound::NotFoundInBlocks {
                    track_section_ranges: vec![],
                    length: 0,
                },
            ))
        };

        let results = find_track_occupancy_for_operational_point(
            op_id,
            &operational_point_track_offsets,
            &PathItemCache::default(),
            &simulation,
            &pathfinding,
            &train_schedule,
        );

        // Check if we got the expected result
        if should_succeed {
            assert_eq!(results.len(), 1);
            let TrackOccupancy {
                time_window:
                    TimeWindow {
                        time_begin,
                        duration,
                    },
                ..
            } = &results[0];

            assert_eq!(
                *time_begin,
                start_time + Duration::milliseconds(expected_time as i64)
            );
            assert_eq!(
                *duration,
                PositiveDuration::try_from(Duration::milliseconds(expected_stop_duration_ms))
                    .unwrap()
            );
        } else {
            // We expect no results in failure cases
            assert_eq!(results.len(), 0);
        }
    }

    #[rstest]
    #[case(25, vec![0, 50, 100], vec![0, 500, 1000], 250)]
    #[case(0, vec![0, 50, 100], vec![0, 500, 1000], 0)]
    #[case(100, vec![0, 50, 100], vec![0, 500, 1000], 1000)]
    fn test_interpolate_arrival_time(
        #[case] position: u64,
        #[case] positions: Vec<u64>,
        #[case] times: Vec<u64>,
        #[case] expected_time: i64,
    ) {
        // Create a report train with given positions and times
        let report_train = ReportTrain {
            positions,
            times,
            speeds: vec![10.0; 5],
            energy_consumption: 0.0,
            path_item_times: vec![],
        };

        let final_output = CompleteReportTrain {
            report_train,
            ..Default::default()
        };

        let result = interpolate_arrival_time(position, &final_output);

        assert_eq!(result, expected_time);
    }

    #[rstest]
    #[case("op_1", Some(0))] // Should find first OP
    #[case("op_2", Some(1))] // Should find second OP
    #[case("op_12", None)] // Should not find non-existent OP
    #[case("T1", None)] // Should skip non-OP items
    fn test_find_matching_path_item_by_id(
        #[case] op_id: &str,
        #[case] expected_index: Option<usize>,
    ) {
        let path = vec![
            PathItem {
                id: "p1".into(),
                location: PathItemLocation::OperationalPointPartReference(
                    OperationalPointPartReference {
                        operational_point: OperationalPointReference::Id {
                            operational_point: "op_1".into(),
                        },
                        track_reference: None,
                    },
                ),
            },
            PathItem {
                id: "p2".into(),
                location: PathItemLocation::OperationalPointPartReference(
                    OperationalPointPartReference {
                        operational_point: OperationalPointReference::Id {
                            operational_point: "op_2".into(),
                        },
                        track_reference: None,
                    },
                ),
            },
        ];
        let cache = PathItemCache::default();

        assert_eq!(
            find_matching_path_item_index(&path, op_id, &cache),
            expected_index
        );
    }
}
