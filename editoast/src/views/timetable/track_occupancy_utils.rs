use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use core_client::simulation::ReportTrain;
use schemas::infra::TrackOffset;
use schemas::primitives::PositiveDuration;
use schemas::train_schedule::OperationalPointIdentifier;
use schemas::train_schedule::PathItemLocation;

use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::path::projection::TrackLocationFromPath;
use crate::views::projection::find_index_upper;
use crate::views::projection::linear_interpolate;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;

#[derive(Debug, Clone)]
pub struct TrackOccupancyResult {
    pub track_section: String,
    pub time_begin: DateTime<Utc>,
    pub duration: PositiveDuration,
}

/// Common function to compute track occupancy on a specific path item
pub fn compute_track_occupancy_on_path_item(
    train_schedule: &schemas::TrainSchedule,
    path_item_id: &str,
    path_item_positions: &[u64],
    path_projection: &PathProjection,
    operational_point_track_offsets: &[TrackOffset],
    report_train: &ReportTrain,
) -> Option<TrackOccupancyResult> {
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

    Some(TrackOccupancyResult {
        track_section,
        time_begin,
        duration: stop_duration,
    })
}

/// Common function to interpolate track occupancy
pub fn interpolate_track_occupancy(
    train_schedule: &schemas::TrainSchedule,
    path_projection: &PathProjection,
    operational_point_track_offsets: &[TrackOffset],
    report_train: &ReportTrain,
) -> Vec<TrackOccupancyResult> {
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

                TrackOccupancyResult {
                    track_section: track_offset.track.to_string(),
                    time_begin,
                    duration: PositiveDuration::default(),
                }
            })
        })
        .collect()
}

/// Match the id of an operational point with a path item in the train schedule
/// Returns the path item id if found
pub fn match_path_item_id_with_operational_point<'a>(
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

/// Extract track ranges and path item positions from pathfinding result
/// Returns None if pathfinding failed
///
/// Note: The timetable can have a pathfinding failure for a train schedule
/// because the train schedule is not valid. We skip it because we don't want
/// to compute the track occupancy for an invalid train schedule.
/// It's not a problem because we are just looking for the track occupancy
/// of the operational point for the valid trains.
pub fn extract_pathfinding_data(
    pathfinding: &PathfindingResult,
) -> Option<(&Vec<core_client::pathfinding::TrackRange>, &Vec<u64>)> {
    match pathfinding {
        PathfindingResult::Success(pathfinding_result_success) => Some((
            &pathfinding_result_success.path.track_section_ranges,
            &pathfinding_result_success.path_item_positions,
        )),
        PathfindingResult::Failure(_) => None,
    }
}

/// Extract report train from simulation result
/// Returns None if simulation failed
pub fn extract_simulation_report_train(simulation: &simulation::Response) -> Option<&ReportTrain> {
    match simulation {
        simulation::Response::Success(SimulationResponseSuccess { final_output, .. }) => {
            Some(&final_output.report_train)
        }
        _ => None,
    }
}

/// Prepared data for computing track occupancy
pub struct TrackOccupancyData<'a> {
    pub path_projection: PathProjection<'a>,
    pub path_item_positions: &'a [u64],
    pub report_train: &'a ReportTrain,
    pub path_item_id: Option<&'a str>,
}

/// Prepare all data needed for track occupancy computation
/// This extracts pathfinding data, simulation data, and finds the matching path item
pub fn prepare_track_occupancy_data<'a>(
    operational_point_id: &str,
    path_item_cache: &PathItemCache,
    simulation: &'a simulation::Response,
    pathfinding: &'a PathfindingResult,
    train_schedule: &'a schemas::TrainSchedule,
) -> Option<TrackOccupancyData<'a>> {
    // Extract pathfinding data
    let (track_ranges, path_item_positions) = extract_pathfinding_data(pathfinding)?;
    let path_projection = PathProjection::new(track_ranges);

    // Extract simulation report
    let report_train = extract_simulation_report_train(simulation)?;

    // Find matching path item
    let path_item_id = match_path_item_id_with_operational_point(
        path_item_cache,
        train_schedule,
        operational_point_id,
    );

    Some(TrackOccupancyData {
        path_projection,
        path_item_positions,
        report_train,
        path_item_id,
    })
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
) -> Vec<TrackOccupancyResult> {
    // Prepare all data for track occupancy computation
    let data = match prepare_track_occupancy_data(
        operational_point_id,
        path_item_cache,
        simulation,
        pathfinding,
        train_schedule,
    ) {
        Some(data) => data,
        None => return vec![],
    };

    // Compute occupancies using either:
    // - Exact schedule data if train stops at this operational point
    // - Interpolation if train just passes through
    if let Some(path_item_id) = data.path_item_id {
        compute_track_occupancy_on_path_item(
            train_schedule,
            path_item_id,
            data.path_item_positions,
            &data.path_projection,
            operational_point_track_offsets,
            data.report_train,
        )
        .into_iter()
        .collect()
    } else {
        interpolate_track_occupancy(
            train_schedule,
            &data.path_projection,
            operational_point_track_offsets,
            data.report_train,
        )
    }
}
