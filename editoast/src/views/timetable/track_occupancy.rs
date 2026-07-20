use common::units::millisecond;
use core_client::simulation::ReportTrain;
use schemas::infra::TrackOffset;
use schemas::primitives::NonBlankString;
use schemas::primitives::TimeWindow;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::ScheduleItem;

use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::projection::interpolate_arrival_time;
use crate::views::timetable::simulation;

#[derive(Debug, Clone)]
pub(super) struct TrackOccupancy {
    pub(super) local_track_name: Option<NonBlankString>,
    pub(super) time_window: TimeWindow,
}

/// Structure holding extracted data needed for track occupancy computation
struct OccupancyContext<'a> {
    op_id: &'a str,
    report_train: Option<&'a ReportTrain>,
    pathfinding_success: Option<&'a core_client::pathfinding::PathfindingResult>,
    matching_index: Option<usize>,
    schedule_item: Option<&'a ScheduleItem>,
}

/// Search for the index of the first matching path item for an operational point in a given path
fn find_matching_path_item_index(
    path_items: &[PathItem],
    operational_point_id: &str,
    op_cache: &OperationalPointCache,
) -> Option<usize> {
    path_items.iter().position(|path_item| {
        let PathItemLocation::OperationalPointPartReference(op_ref) = &path_item.location else {
            return false;
        };

        op_cache
            .get_op_ref_id(&op_ref.operational_point)
            .is_some_and(|id| id == operational_point_id)
    })
}

/// Extracts all context needed for track occupancy computation
fn extract_occupancy_context<'a>(
    operational_point_id: &'a str,
    op_cache: &OperationalPointCache,
    simulation: &'a simulation::Response,
    pathfinding: &'a PathfindingResult,
    train_schedule: &'a schemas::TrainOccurrence,
) -> OccupancyContext<'a> {
    let report_train = match simulation {
        simulation::Response::Success(simulation) => simulation::path_item_respect_times(
            &simulation.final_output.report_train.path_item_times,
            train_schedule,
        )
        .into_iter()
        .all(|path_item| path_item)
        .then_some(&simulation.final_output.report_train),
        _ => None,
    };

    let pathfinding_success = match pathfinding {
        PathfindingResult::Success(pathfinding_success) => Some(pathfinding_success),
        _ => None,
    };

    OccupancyContext {
        op_id: operational_point_id,
        report_train,
        pathfinding_success,
        ..extract_occupancy_context_without_simulation(
            operational_point_id,
            op_cache,
            train_schedule,
        )
    }
}

fn extract_occupancy_context_without_simulation<'a>(
    operational_point_id: &'a str,
    op_cache: &OperationalPointCache,
    train_schedule: &'a schemas::TrainOccurrence,
) -> OccupancyContext<'a> {
    let matching_index =
        find_matching_path_item_index(&train_schedule.path, operational_point_id, op_cache);

    let schedule_item = matching_index.and_then(|idx| {
        train_schedule
            .schedule
            .iter()
            .find(|schedule| schedule.at.0 == train_schedule.path[idx].id.0)
    });

    OccupancyContext {
        op_id: operational_point_id,
        report_train: None,
        pathfinding_success: None,
        matching_index,
        schedule_item,
    }
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
                    .report_train
                    .map(|report_train| report_train.path_item_times[idx] as i64)
            })
            .or_else(|| {
                context
                    .schedule_item
                    .and_then(|s| s.arrival.as_ref())
                    .map(|a| a.num_milliseconds())
            });
    }
    if let (Some(report_train), Some(pathfinding_success)) =
        (context.report_train, context.pathfinding_success)
    {
        let path_projection = PathProjection::new(&pathfinding_success.path.track_section_ranges);
        return operational_point_track_offsets
            .iter()
            .find_map(|track_offset| {
                path_projection
                    .get_position(track_offset)
                    .map(|position| interpolate_arrival_time(position, report_train))
            });
    }
    None
}

// Returns the local_track_name for an operational point, using pathfinding or input.
fn get_local_track_name(
    context: &OccupancyContext,
    operational_point_track_offsets: &[TrackOffset],
    op_cache: &OperationalPointCache,
    train_schedule: &schemas::TrainOccurrence,
) -> Option<NonBlankString> {
    if let Some(idx) = context.matching_index {
        let PathItemLocation::OperationalPointPartReference(op_ref) =
            &train_schedule.path[idx].location
        else {
            panic!("matching_index must reference an OperationalPointPartReference")
        };
        if op_ref.local_track_name.is_some() {
            return op_ref.local_track_name.clone();
        }
    }

    let pathfinding_success = context.pathfinding_success?;

    let path_projection = PathProjection::new(&pathfinding_success.path.track_section_ranges);
    operational_point_track_offsets
        .iter()
        .find(|to| path_projection.get_position(to).is_some())
        .and_then(|to| op_cache.get_name_by_track(context.op_id.to_string(), to.track.as_str()))
        .cloned()
}

/// Find track occupancies for a train at an operational point
/// This is a generic function used by both train_schedule and paced_train modules
pub fn find_track_occupancy_for_operational_point(
    operational_point_id: &str,
    operational_point_track_offsets: &[TrackOffset],
    op_cache: &OperationalPointCache,
    simulation: &simulation::Response,
    pathfinding: &PathfindingResult,
    train_schedule: &schemas::TrainOccurrence,
) -> Vec<TrackOccupancy> {
    let context = extract_occupancy_context(
        operational_point_id,
        op_cache,
        simulation,
        pathfinding,
        train_schedule,
    );
    find_track_occupancy_for_operational_point_with_context(
        context,
        operational_point_track_offsets,
        op_cache,
        train_schedule,
    )
}

pub fn find_track_occupancy_for_operational_point_without_simulation(
    operational_point_id: &str,
    operational_point_track_offsets: &[TrackOffset],
    op_cache: &OperationalPointCache,
    train_schedule: &schemas::TrainOccurrence,
) -> Vec<TrackOccupancy> {
    let context = extract_occupancy_context_without_simulation(
        operational_point_id,
        op_cache,
        train_schedule,
    );
    find_track_occupancy_for_operational_point_with_context(
        context,
        operational_point_track_offsets,
        op_cache,
        train_schedule,
    )
}

fn find_track_occupancy_for_operational_point_with_context<'a>(
    context: OccupancyContext<'a>,
    operational_point_track_offsets: &[TrackOffset],
    op_cache: &OperationalPointCache,
    train_schedule: &schemas::TrainOccurrence,
) -> Vec<TrackOccupancy> {
    let Some(arrival_time) = get_arrival_time(&context, operational_point_track_offsets) else {
        return vec![];
    };

    let stop_duration = context
        .schedule_item
        .and_then(|item| item.stop_for)
        .unwrap_or_default();

    vec![TrackOccupancy {
        local_track_name: get_local_track_name(
            &context,
            operational_point_track_offsets,
            op_cache,
            train_schedule,
        ),
        time_window: TimeWindow {
            time_begin: train_schedule.start_time + millisecond::i64::new(arrival_time),
            duration: stop_duration,
        },
    }]
}

#[cfg(test)]
pub mod tests {
    use crate::error::InternalError;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::timetable::simulation::SimulationResponseSuccess;
    use chrono::Duration;
    use common::units::millisecond;
    use core_client::pathfinding::PathfindingNotFound;
    use core_client::pathfinding::TrackRange;
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ReportTrain;
    use pretty_assertions::assert_eq;
    use reqwest::StatusCode;
    use rstest::rstest;
    use schemas::fixtures::ms_since_epoch;
    use schemas::infra::Direction;
    use schemas::infra::TrackOffset;
    use schemas::primitives::Identifier;
    use schemas::primitives::PositiveDuration;
    use schemas::train_schedule::OperationalPointPartReference;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::ReceptionSignal;
    use std::collections::HashMap;
    use std::collections::HashSet;

    use super::*;

    fn make_simulation_success(path_item_times: Vec<u64>) -> simulation::Response {
        let report_train = ReportTrain {
            positions: vec![],
            times: vec![],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times,
        };
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
    }

    fn make_pathfinding_success(
        track_section: Identifier,
        path_item_positions: Vec<u64>,
    ) -> PathfindingResult {
        PathfindingResult::Success(core_client::pathfinding::PathfindingResult {
            path: core_client::pathfinding::TrainPath {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![TrackRange {
                    track_section,
                    begin: 0,
                    end: 100,
                    direction: Direction::StartToStop,
                }],
            },
            length: 100,
            path_item_positions,
            backtrack_path_items: Some(vec![]),
        })
    }

    #[rstest]
    // Normal cases with both simulation and pathfinding
    #[case("op_2", 1000, 300000, true, true, true)]
    // Edge cases: missing simulation or pathfinding
    #[case("op_1", 0, 0, false, true, true)] // op_1 at index 0 works without simulation
    #[case("op_1", 0, 0, false, false, true)] // op_1 at index 0 works without pathfinding
    #[case("op_2", 1000, 300000, false, true, false)] // No simulation fails (no arrival_time)
    #[case("op_3", 5000, 200000, false, false, true)] // op_3 works without simulation/pathfinding (explicit arrival + local_track_name)
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
        let op_cache = OperationalPointCache::new(
            Vec::new(),
            HashMap::new(),
            HashMap::new(),
            HashMap::from([
                ("op_1".to_string(), 0),
                ("op_2".to_string(), 0),
                ("op_3".to_string(), 0),
            ]),
            HashSet::new(),
            vec![HashMap::from([
                ("T1".into(), "V1".into()),
                ("T2".into(), "V2".into()),
                ("T3".into(), "V3".into()),
            ])],
        );

        let operational_point_track_offsets = vec![TrackOffset {
            track: track_section.clone(),
            offset: track_offset,
        }];

        // Create a train schedule with path items and schedule items
        let start_time = ms_since_epoch("2001-09-09T01:46:40Z");
        let train_schedule = schemas::TrainOccurrence {
            start_time,
            path: vec![
                PathItem {
                    id: "path_item_1".into(),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Id {
                                operational_point: "op_1".into(),
                            },
                            local_track_name: None,
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
                            local_track_name: None,
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
                            local_track_name: Some("V3".into()),
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
                    ..Default::default()
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
                    ..Default::default()
                },
            ],
            ..Default::default()
        };

        // Call the function
        let simulation = if has_simulation {
            make_simulation_success(vec![0, expected_time, 5000])
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
            make_pathfinding_success(track_section.clone(), path_item_positions)
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
            &op_cache,
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
                start_time + millisecond::i64::new(expected_time as i64)
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
                        local_track_name: None,
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
                        local_track_name: None,
                    },
                ),
            },
        ];
        let cache = OperationalPointCache::default();

        assert_eq!(
            find_matching_path_item_index(&path, op_id, &cache),
            expected_index
        );
    }

    #[test]
    fn test_schedule_arrival_used_when_simulation_does_not_honor_times() {
        let start_time = ms_since_epoch("2026-02-01T00:00:00Z");

        let train_schedule = schemas::TrainOccurrence {
            start_time,
            path: vec![
                PathItem::new_operational_point("op_1"),
                PathItem::new_operational_point("op_2"),
            ],
            schedule: vec![ScheduleItem {
                at: "op_2".into(),
                arrival: Some(PositiveDuration::try_from(Duration::minutes(5)).unwrap()),
                stop_for: Some(
                    PositiveDuration::try_from(Duration::seconds(0))
                        .expect("Failed to parse duration"),
                ),
                reception_signal: ReceptionSignal::Open,
                ..Default::default()
            }],
            ..Default::default()
        };

        // simulation arrival_time: 10min, input arrival_time: 5min
        let simulation = make_simulation_success(vec![0, 600_000]);
        let pathfinding = make_pathfinding_success(Identifier::from("T2"), vec![0, 100]);

        let op_cache = OperationalPointCache::new(
            Vec::new(),
            HashMap::new(),
            HashMap::new(),
            HashMap::from([("op_2".to_string(), 0)]),
            HashSet::new(),
            vec![HashMap::from([("T2".into(), "V2".into())])],
        );

        let operational_point_track_offsets = vec![TrackOffset {
            track: Identifier::from("T2"),
            offset: 100,
        }];

        let results = find_track_occupancy_for_operational_point(
            "op_2",
            &operational_point_track_offsets,
            &op_cache,
            &simulation,
            &pathfinding,
            &train_schedule,
        );

        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].local_track_name,
            Some(NonBlankString("V2".to_string()))
        );
        assert_eq!(
            results[0].time_window.time_begin,
            start_time + millisecond::i64::new(300_000)
        );
    }
}
