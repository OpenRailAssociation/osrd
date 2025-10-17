use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use core_client::simulation::ReportTrain;
use schemas::infra::TrackOffset;
use schemas::primitives::PositiveDuration;
use schemas::train_schedule::OperationalPointIdentifier;
use schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::path::projection::TrackLocationFromPath;
use crate::views::projection::find_index_upper;
use crate::views::projection::linear_interpolate;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub(super) struct TimeWindow {
    pub(super) time_begin: DateTime<Utc>,
    #[schema(value_type = chrono::Duration, example = "PT5M")]
    pub(super) duration: PositiveDuration,
}

#[derive(Debug, Clone)]
pub(super) struct TrackOccupancy {
    pub(super) track_section: String,
    pub(super) time_window: TimeWindow,
}

/// Common function to compute track occupancy on a specific path item
fn compute_track_occupancy_on_path_item(
    train_schedule: &schemas::TrainSchedule,
    path_item_id: &str,
    path_item_positions: &[u64],
    path_projection: &PathProjection,
    operational_point_track_offsets: &[TrackOffset],
    report_train: &ReportTrain,
) -> Option<TrackOccupancy> {
    let schedule_item = train_schedule
        .schedule
        .iter()
        .find(|schedule| schedule.at.0 == path_item_id);

    let stop_duration = schedule_item
        .and_then(|item| item.stop_for.clone())
        .unwrap_or_default();

    let index = train_schedule
        .path
        .iter()
        .position(|path| path.id.0 == path_item_id)?;

    let position = path_item_positions[index];
    let time = report_train.path_item_times[index];

    let track_section = match path_projection.get_location(position) {
        TrackLocationFromPath::One(track_offset) => operational_point_track_offsets
            .iter()
            .find(|to| *to == &track_offset)?
            .track
            .to_string(),
        TrackLocationFromPath::Two(track_offset, track_offset1) => operational_point_track_offsets
            .iter()
            .find(|to| *to == &track_offset)
            .or(operational_point_track_offsets
                .iter()
                .find(|to| *to == &track_offset1))?
            .track
            .to_string(),
    };

    let time_begin = train_schedule.start_time + Duration::milliseconds(time as i64);

    Some(TrackOccupancy {
        track_section,
        time_window: TimeWindow {
            time_begin,
            duration: stop_duration,
        },
    })
}

/// Common function to interpolate track occupancy
fn interpolate_track_occupancy(
    train_schedule: &schemas::TrainSchedule,
    path_projection: &PathProjection,
    operational_point_track_offsets: &[TrackOffset],
    report_train: &ReportTrain,
) -> Vec<TrackOccupancy> {
    operational_point_track_offsets
        .iter()
        .filter_map(|track_offset| {
            path_projection.get_position(track_offset).map(|position| {
                let index = find_index_upper(&report_train.positions, position);
                let time = if index == 0 {
                    report_train.times[0]
                } else {
                    linear_interpolate(
                        report_train.positions[index - 1],
                        report_train.positions[index],
                        report_train.times[index - 1],
                        report_train.times[index],
                        position,
                    )
                };

                let time_begin = train_schedule.start_time + Duration::milliseconds(time as i64);

                TrackOccupancy {
                    track_section: track_offset.track.to_string(),
                    time_window: TimeWindow {
                        time_begin,
                        duration: PositiveDuration::default(),
                    },
                }
            })
        })
        .collect()
}

/// Match the id of an operational point with a path item in the train schedule
/// Returns the path item id if found
fn match_path_item_id_with_operational_point<'a>(
    path_item_cache: &PathItemCache,
    train_schedule: &'a schemas::TrainSchedule,
    operational_point_id: &str,
) -> Option<&'a str> {
    for path_item in &train_schedule.path {
        if let PathItemLocation::OperationalPointReference(operational_point_reference) =
            &path_item.location
        {
            match &operational_point_reference.reference {
                OperationalPointIdentifier::OperationalPointId { operational_point } => {
                    if operational_point.0 == operational_point_id {
                        return Some(&path_item.id.0);
                    }
                }
                OperationalPointIdentifier::OperationalPointDescription { trigram, .. } => {
                    let operational_points = path_item_cache
                        .get_from_trigram(&trigram.0)
                        .expect("The operational points are supposed to exist");
                    if operational_points
                        .iter()
                        .any(|op| op.obj_id == operational_point_id)
                    {
                        return Some(&path_item.id.0);
                    }
                }
                OperationalPointIdentifier::OperationalPointUic { uic, .. } => {
                    let ops = path_item_cache
                        .get_from_uic(*uic)
                        .expect("The operational points are supposed to exist");
                    if ops.iter().any(|op| op.obj_id == operational_point_id) {
                        return Some(&path_item.id.0);
                    }
                }
            }
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
    // Extract pathfinding data
    let (track_ranges, path_item_positions) = match pathfinding {
        PathfindingResult::Success(pathfinding_result_success) => {
            assert_eq!(
                pathfinding_result_success.path_item_positions.len(),
                train_schedule.path.len()
            );
            (
                &pathfinding_result_success.path.track_section_ranges,
                &pathfinding_result_success.path_item_positions,
            )
        }
        PathfindingResult::Failure(_) => {
            // The timetable can have a pathfinding failure for a train schedule
            // because the train schedule is not valid.
            // We skip it because we don't want to compute the track occupancy for an invalid train schedule.
            // It's not a problem because we are just looking for the track occupancy of the operational point for the valid trains.
            tracing::info!(train_schedule.train_name, "pathfinding failed");
            return vec![];
        }
    };
    let path_projection = PathProjection::new(track_ranges);

    // Get the positions and the times from the simulation
    let report_train = match simulation {
        simulation::Response::Success(SimulationResponseSuccess { final_output, .. }) => {
            &final_output.report_train
        }
        _ => {
            tracing::info!(train_schedule.train_name, "simulation failed");
            return vec![];
        }
    };

    // Find matching path item
    let path_item_id = match_path_item_id_with_operational_point(
        path_item_cache,
        train_schedule,
        operational_point_id,
    );

    // Compute occupancies using either:
    // - Exact schedule data if train stops at this operational point
    // - Interpolation if train just passes through
    if let Some(path_item_id) = path_item_id {
        compute_track_occupancy_on_path_item(
            train_schedule,
            path_item_id,
            path_item_positions,
            &path_projection,
            operational_point_track_offsets,
            report_train,
        )
        .into_iter()
        .collect()
    } else {
        interpolate_track_occupancy(
            train_schedule,
            &path_projection,
            operational_point_track_offsets,
            report_train,
        )
    }
}

#[cfg(test)]
pub mod tests {
    use chrono::DateTime;
    use chrono::Duration;
    use core_client::pathfinding::TrackRange;
    use core_client::simulation::ReportTrain;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::infra::Direction;
    use schemas::infra::TrackOffset;
    use schemas::primitives::Identifier;
    use schemas::train_schedule::OperationalPointIdentifier;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::PathItem;
    use schemas::train_schedule::ReceptionSignal;
    use schemas::train_schedule::ScheduleItem;

    use super::*;

    use crate::models;
    use crate::views::path::projection::PathProjection;

    #[rstest]
    #[case("T2", 50, Direction::StartToStop, vec![0, 100], vec![0, 1000], Some("T2"))]
    #[case("T2", 150, Direction::StartToStop, vec![0, 100], vec![0, 1000], None)]
    #[case("T2", 50, Direction::StopToStart, vec![0, 100], vec![0, 1000], Some("T2"))]
    fn test_interpolate_track_occupancy(
        #[case] track_name: &str,
        #[case] offset: u64,
        #[case] direction: Direction,
        #[case] positions: Vec<u64>,
        #[case] times: Vec<u64>,
        #[case] expected_track: Option<&str>,
    ) {
        let track_section = Identifier::from(track_name);
        let track_range = TrackRange {
            track_section: track_section.clone(),
            begin: 0,
            end: 100,
            direction,
        };
        let track_range_vec = vec![track_range];
        let path_projection = PathProjection::new(&track_range_vec);
        let operational_point_track_offsets = vec![TrackOffset {
            track: track_section.clone(),
            offset,
        }];
        let report_train = ReportTrain {
            positions: positions.clone(),
            times: times.clone(),
            speeds: vec![10.0; positions.len()],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1000],
        };
        let train_schedule: schemas::TrainSchedule = models::TrainSchedule::default().into();
        let result = interpolate_track_occupancy(
            &train_schedule,
            &path_projection,
            &operational_point_track_offsets,
            &report_train,
        );

        assert_eq!(
            result.first().map(|r| r.track_section.as_str()),
            expected_track
        );
    }

    #[rstest]
    #[case("path_item_1", vec![50, 100, 150], 50, "T1", "T1", 0, 500)]
    #[case("path_item_2", vec![50, 75, 150], 75, "T2", "T2", 1000, 300000)]
    fn test_track_occupancy_on_path_item(
        #[case] path_item_id: &str,
        #[case] path_item_positions: Vec<u64>,
        #[case] track_offset: u64,
        #[case] track_name: &str,
        #[case] expected_track: &str,
        #[case] expected_time: u64,
        #[case] expected_stop_duration_ms: i64,
    ) {
        // Create test data
        let track_section = Identifier::from(track_name);
        let track_range = TrackRange {
            track_section: track_section.clone(),
            begin: 0,
            end: 150,
            direction: Direction::StartToStop,
        };
        let track_ranges = vec![track_range];
        let path_projection = PathProjection::new(&track_ranges);

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
        let train_schedule = models::TrainSchedule {
            start_time,
            path: vec![
                PathItem {
                    id: "path_item_1".into(),
                    location: PathItemLocation::OperationalPointReference(
                        OperationalPointReference {
                            reference: OperationalPointIdentifier::OperationalPointId {
                                operational_point: "op_1".into(),
                            },
                            track_reference: None,
                        },
                    ),
                    deleted: false,
                },
                PathItem {
                    id: "path_item_2".into(),
                    location: PathItemLocation::OperationalPointReference(
                        OperationalPointReference {
                            reference: OperationalPointIdentifier::OperationalPointId {
                                operational_point: "op_2".into(),
                            },
                            track_reference: None,
                        },
                    ),
                    deleted: false,
                },
                PathItem {
                    id: "path_item_invalid".into(),
                    location: PathItemLocation::OperationalPointReference(
                        OperationalPointReference {
                            reference: OperationalPointIdentifier::OperationalPointId {
                                operational_point: "op_invalid".into(),
                            },
                            track_reference: None,
                        },
                    ),
                    deleted: false,
                },
            ],
            schedule: vec![
                ScheduleItem {
                    at: "path_item_1".into(),
                    arrival: None,
                    stop_for: Some(
                        PositiveDuration::try_from(Duration::milliseconds(500)).unwrap(),
                    ),
                    locked: false,
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem {
                    at: "path_item_2".into(),
                    arrival: None,
                    stop_for: Some(
                        PositiveDuration::try_from(Duration::milliseconds(300000)).unwrap(),
                    ),
                    locked: false,
                    reception_signal: ReceptionSignal::Open,
                },
            ],
            ..models::TrainSchedule::default()
        };

        // Call the function
        let TrackOccupancy {
            track_section,
            time_window:
                TimeWindow {
                    time_begin,
                    duration,
                },
        } = compute_track_occupancy_on_path_item(
            &train_schedule.into(),
            path_item_id,
            &path_item_positions,
            &path_projection,
            &operational_point_track_offsets,
            &report_train,
        )
        .expect("computation should be successful according to test inputs");

        assert_eq!(track_section, expected_track);
        assert_eq!(
            time_begin,
            start_time + Duration::milliseconds(expected_time as i64)
        );
        assert_eq!(
            duration,
            PositiveDuration::try_from(Duration::milliseconds(expected_stop_duration_ms)).unwrap()
        );
    }
}
