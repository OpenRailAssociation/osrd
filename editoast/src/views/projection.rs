use crate::error::Result;
use core_client::CoreClient;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::pathfinding::TrackRange;
use core_client::simulation::CompleteReportTrain;
use core_client::simulation::ReportTrain;
use core_client::simulation::SignalCriticalPosition;
use core_client::simulation::ZoneUpdate;
use editoast_models::DbConnection;
use editoast_schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::ValkeyClient;
use crate::client::get_app_version;
use crate::models;
use crate::models::infra::Infra;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::path::projection::TrackLocationFromPath;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::train_simulation_batch;

editoast_common::schemas! {
    ProjectPathForm,
    SpaceTimeCurve,
}

pub type SpaceTimeCurves = Vec<SpaceTimeCurve>;

#[derive(Debug, Deserialize, ToSchema)]
pub struct ProjectPathForm {
    pub infra_id: i64,
    pub electrical_profile_set_id: Option<i64>,
    pub ids: HashSet<i64>,
    #[schema(inline)]
    pub track_section_ranges: Vec<TrackRange>,
}

/// Project path input is described by a list of routes and a list of track range
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProjectPathInput {
    /// List of track ranges
    #[schema(min_items = 1)]
    pub track_section_ranges: Vec<TrackRange>,
    /// List of route ids
    #[schema(inline, min_items = 1)]
    pub routes: Vec<Identifier>,
    /// Path description as block ids
    #[schema(inline, min_items = 1)]
    pub blocks: Vec<Identifier>,
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct SpaceTimeCurve {
    // List of positions of a train in mm
    // Both positions and times must have the same length
    #[schema(min_items = 2)]
    positions: Vec<u64>,
    // List of times in ms since `departure_time` associated to a position
    #[schema(min_items = 2)]
    times: Vec<u64>,
}

/// Input for the projection of a train schedule on a path
#[derive(Debug, Clone, Hash)]
pub struct TrainSimulationDetails {
    pub positions: Vec<u64>,
    pub times: Vec<u64>,
    pub train_path: Vec<TrackRange>,
    pub signal_critical_positions: Vec<SignalCriticalPosition>,
    pub zone_updates: Vec<ZoneUpdate>,
}

impl TrainSimulationDetails {
    // Compute hash input of the projection of a train schedule on a path
    pub fn compute_projection_hash_with_versioning(
        &self,
        infra_id: i64,
        infra_version: i64,
        path_projection_tracks: &[TrackRange],
    ) -> String {
        let osrd_version = get_app_version().unwrap_or_default();
        let mut hasher = DefaultHasher::new();
        self.positions.hash(&mut hasher);
        self.times.hash(&mut hasher);
        self.train_path.hash(&mut hasher);
        path_projection_tracks.hash(&mut hasher);
        let hash_simulation_input = hasher.finish();
        format!("projection_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
    }

    // Compute hash input of the occupancy block of a train schedule on a path
    pub fn compute_occupancy_block_hash_with_versioning(
        &self,
        infra_id: i64,
        infra_version: i64,
        path_projection_tracks: &[TrackRange],
        path_routes: &[Identifier],
        path_blocks: &[Identifier],
    ) -> String {
        let osrd_version = get_app_version().unwrap_or_default();
        let mut hasher = DefaultHasher::new();
        self.signal_critical_positions.hash(&mut hasher);
        self.zone_updates.hash(&mut hasher);
        self.train_path.hash(&mut hasher);
        path_projection_tracks.hash(&mut hasher);
        path_routes.hash(&mut hasher);
        path_blocks.hash(&mut hasher);
        let hash_simulation_input = hasher.finish();
        format!("occupancy_block_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
    }
}

/// Compute the space time curves of a train schedule on a path
fn compute_space_time_curves(
    project_path_input: &TrainSimulationDetails,
    path_projection: &PathProjection,
) -> SpaceTimeCurves {
    let train_path = PathProjection::new(&project_path_input.train_path);
    let intersections = path_projection.get_intersections(&project_path_input.train_path);
    let positions = &project_path_input.positions;
    let times = &project_path_input.times;

    assert_eq!(positions[0], 0);
    assert_eq!(positions[positions.len() - 1], train_path.len());
    assert_eq!(positions.len(), times.len());

    let mut space_time_curves = vec![];
    for intersection in intersections {
        let start = intersection.start();
        let end = intersection.end();
        let start_index = find_index_upper(positions, start);
        let end_index = find_index_upper(positions, end);

        // Each segment contains the start, end and all positions between them
        // We must interpolate the start and end positions if they are not part of the positions
        let mut segment_positions = Vec::with_capacity(end_index - start_index + 2);
        let mut segment_times = Vec::with_capacity(end_index - start_index + 2);
        if positions[start_index] > start {
            // Interpolate the first point of the segment
            segment_positions.push(project_pos(start, &train_path, path_projection));
            segment_times.push(interpolate(
                positions[start_index - 1],
                positions[start_index],
                times[start_index - 1],
                times[start_index],
                start,
            ));
        }

        // Project all the points in the segment
        for index in start_index..end_index {
            segment_positions.push(project_pos(positions[index], &train_path, path_projection));
            segment_times.push(times[index]);
        }

        // Interpolate the last point of the segment
        segment_positions.push(project_pos(end, &train_path, path_projection));
        segment_times.push(interpolate(
            positions[end_index - 1],
            positions[end_index],
            times[end_index - 1],
            times[end_index],
            end,
        ));
        space_time_curves.push(SpaceTimeCurve {
            positions: segment_positions,
            times: segment_times,
        });
    }
    space_time_curves
}

/// Find the index of the first element greater to a value
///
/// **Values must be sorted in ascending order**
///
/// ## Panics
///
/// - If value is greater than the last element of values.
/// - If values is empty
pub fn find_index_upper(values: &[u64], value: u64) -> usize {
    assert!(!values.is_empty(), "Values can't be empty");
    assert!(
        value <= values[values.len() - 1],
        "Value can't be greater than the last element"
    );
    // Binary search that retrieve the smallest index of the first element greater than value
    let mut left = 0;
    let mut right = values.len();
    while left < right {
        let mid = (left + right) / 2;
        if values[mid] > value {
            right = mid;
        } else {
            left = mid + 1;
        }
    }
    if values[right - 1] == value {
        right - 1
    } else {
        right
    }
}

/// Project a position on a train path to a position on a projection path
///
/// ## Panics
///
/// Panics if the position is not part of **both** paths
fn project_pos(
    train_pos: u64,
    train_path: &PathProjection,
    path_projection: &PathProjection,
) -> u64 {
    match train_path.get_location(train_pos) {
        TrackLocationFromPath::One(loc) => path_projection
            .get_position(&loc)
            .expect("Position should be in the projection path"),
        TrackLocationFromPath::Two(loc_a, loc_b) => {
            path_projection.get_position(&loc_a).unwrap_or_else(|| {
                path_projection
                    .get_position(&loc_b)
                    .expect("Position should be in the projection path")
            })
        }
    }
}

/// Interpolate a time value between two positions
pub fn interpolate(
    start_pos: u64,
    end_pos: u64,
    start_time: u64,
    end_time: u64,
    pos_to_interpolate: u64,
) -> u64 {
    if start_pos == end_pos {
        start_time
    } else {
        start_time
            + (pos_to_interpolate - start_pos) * (end_time - start_time) / (end_pos - start_pos)
    }
}

pub async fn compute_projected_train_paths(
    conn: &mut DbConnection,
    core_client: Arc<CoreClient>,
    valkey_client: Arc<ValkeyClient>,
    track_section_ranges: Vec<TrackRange>,
    infra: &Infra,
    train_schedules: &[models::TrainSchedule],
    electrical_profile_set_id: Option<i64>,
) -> Result<Vec<Arc<SpaceTimeCurves>>> {
    let path_projection = PathProjection::new(&track_section_ranges);
    let mut valkey_conn = valkey_client.get_connection().await?;

    // 1. Get train simulations
    let simulations = train_simulation_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        train_schedules,
        infra,
        electrical_profile_set_id,
    )
    .await?;

    // 2. Extracts train simulation details and computes unique hashes for projected train paths.
    let trains_details = extract_train_details(simulations).await?;

    let train_hashes_to_idx: HashMap<String, Vec<usize>> = trains_details
        .iter()
        .enumerate()
        .filter_map(|(index, train_details)| {
            train_details.as_ref().map(|train_details| {
                (
                    index,
                    train_details.compute_projection_hash_with_versioning(
                        infra.id,
                        infra.version,
                        &track_section_ranges,
                    ),
                )
            })
        })
        .fold(HashMap::new(), |mut map, (index, hash)| {
            map.entry(hash).or_default().push(index);
            map
        });
    let train_hashes: Vec<_> = train_hashes_to_idx.keys().cloned().collect();

    // 3. Retrieve cached projection

    let cached_projections = valkey_conn
        .json_get_bulk(&train_hashes)
        .await?
        .collect::<Vec<Option<SpaceTimeCurves>>>();

    let mut projection_request_map: HashMap<String, TrainSimulationDetails> = HashMap::new();
    let mut project_path_result: Vec<Arc<SpaceTimeCurves>> =
        vec![Arc::default(); train_schedules.len()];
    for (hash, projection) in train_hashes.into_iter().zip(cached_projections) {
        if let Some(projection) = projection {
            let indexes = &train_hashes_to_idx[&hash];
            let projection = Arc::new(projection);
            for index in indexes {
                project_path_result[*index] = projection.clone();
            }
        } else {
            let index = train_hashes_to_idx[&hash]
                .first()
                .expect("indexes should not be empty");
            projection_request_map.insert(
                hash,
                trains_details[*index]
                    .clone()
                    .expect("train_details must exist if hash is computed"),
            );
        }
    }

    // 4. Compute space time curves for all miss cache

    let space_time_curves = projection_request_map
        .into_iter()
        .map(|(hash, train_details)| {
            (
                hash,
                compute_space_time_curves(&train_details, &path_projection),
            )
        })
        .collect::<Vec<_>>();

    // 5. Store the projection in the cache
    valkey_conn.json_set_bulk(&space_time_curves).await?;

    // 6. Build the projection response
    for (hash, space_time_curve) in space_time_curves.into_iter() {
        let indexes = &train_hashes_to_idx[&hash];
        let space_time_curve = Arc::new(space_time_curve);
        for index in indexes {
            project_path_result[*index] = space_time_curve.clone();
        }
    }

    Ok(project_path_result)
}

pub async fn extract_train_details(
    simulations: Vec<(Arc<simulation::Response>, Arc<PathfindingResult>)>,
) -> Result<Vec<Option<TrainSimulationDetails>>> {
    let mut trains_details = vec![];

    for (sim, pathfinding_result) in simulations {
        let track_ranges = match pathfinding_result.as_ref() {
            PathfindingResult::Success(PathfindingResultSuccess {
                track_section_ranges,
                ..
            }) => track_section_ranges,
            _ => {
                trains_details.push(None);
                continue;
            }
        };

        let CompleteReportTrain {
            report_train,
            signal_critical_positions,
            zone_updates,
            ..
        } = match Arc::unwrap_or_clone(sim) {
            simulation::Response::Success(SimulationResponseSuccess { final_output, .. }) => {
                final_output
            }
            _ => {
                trains_details.push(None);
                continue;
            }
        };
        let ReportTrain {
            times, positions, ..
        } = report_train;

        let train_details = TrainSimulationDetails {
            positions,
            times,
            signal_critical_positions,
            zone_updates,
            train_path: track_ranges.clone(),
        };

        trains_details.push(Some(train_details));
    }
    Ok(trains_details)
}

#[cfg(test)]
mod tests {
    use super::*;
    use editoast_schemas::infra::Direction;
    use editoast_schemas::infra::DirectionalTrackRange;
    use rstest::rstest;

    #[rstest]
    #[case(1, 0)]
    #[case(2, 1)]
    #[case(3, 1)]
    #[case(4, 2)]
    #[case(5, 3)]
    #[case(6, 4)]
    #[case(7, 4)]
    #[case(8, 5)]
    #[case(9, 6)]
    fn test_find_index_upper(#[case] value: u64, #[case] expected: usize) {
        let values = vec![1, 3, 4, 5, 7, 8, 9];
        assert_eq!(find_index_upper(&values, value), expected);
    }

    #[rstest]
    fn test_compute_space_time_curves_case_1() {
        let positions: Vec<u64> = vec![0, 100, 200, 300, 400, 600, 730, 1_000_000];
        let times: Vec<u64> = vec![0, 10, 20, 30, 40, 50, 70, 90];
        let path = vec![
            DirectionalTrackRange::new("A", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 0., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
            DirectionalTrackRange::new("D", 120., 250., Direction::StopToStart).into(),
        ];
        let path_projection = PathProjection::new(&path);

        let train_path = vec![
            DirectionalTrackRange::new("A", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 0., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
            DirectionalTrackRange::new("D", 0., 250., Direction::StopToStart).into(),
            DirectionalTrackRange::new("E", 0., 150., Direction::StartToStop).into(),
        ];

        let project_path_input = TrainSimulationDetails {
            positions,
            times,
            train_path,
            signal_critical_positions: vec![],
            zone_updates: vec![],
        };

        let space_time_curves = compute_space_time_curves(&project_path_input, &path_projection);
        assert_eq!(space_time_curves.clone().len(), 1);
        let curve = &space_time_curves[0];
        assert_eq!(curve.times.len(), curve.positions.len());
        assert_eq!(
            curve.positions,
            vec![0, 100, 200, 300, 400, 600, 730, 730_000]
        );
    }

    #[rstest]
    fn test_compute_space_time_curves_case_2() {
        let positions: Vec<u64> = vec![0, 100, 200, 300, 400, 730_000];
        let times: Vec<u64> = vec![0, 10, 20, 30, 40, 70];
        let path = vec![
            DirectionalTrackRange::new("A", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 0., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
            DirectionalTrackRange::new("D", 120., 250., Direction::StopToStart).into(),
        ];
        let path_projection = PathProjection::new(&path);

        let train_path = vec![
            DirectionalTrackRange::new("A", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 0., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
            DirectionalTrackRange::new("D", 120., 250., Direction::StopToStart).into(),
        ];

        let project_path_input = TrainSimulationDetails {
            positions: positions.clone(),
            times: times.clone(),
            train_path,
            signal_critical_positions: vec![],
            zone_updates: vec![],
        };

        let space_time_curves = compute_space_time_curves(&project_path_input, &path_projection);
        assert_eq!(space_time_curves.clone().len(), 1);
        let curve = &space_time_curves[0];
        assert_eq!(curve.positions, positions);
        assert_eq!(curve.times, times);
    }

    #[rstest]
    fn test_compute_space_time_curves_case_3() {
        let positions: Vec<u64> = vec![
            0, 100_000, 200_000, 300_000, 400_000, 450_000, 500_000, 600_000, 720_000,
        ];
        let times: Vec<u64> = vec![0, 10, 20, 30, 40, 50, 60, 70, 80];

        let train_path = vec![
            DirectionalTrackRange::new("A", 50., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 0., 200., Direction::StartToStop).into(),
            DirectionalTrackRange::new("X", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("C", 0., 200., Direction::StopToStart).into(),
            DirectionalTrackRange::new("Z", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("E", 30., 100., Direction::StartToStop).into(),
        ];

        let path = vec![
            DirectionalTrackRange::new("A", 0., 100., Direction::StartToStop).into(),
            DirectionalTrackRange::new("B", 0., 200., Direction::StartToStop).into(),
            DirectionalTrackRange::new("C", 0., 300., Direction::StartToStop).into(),
            DirectionalTrackRange::new("D", 0., 250., Direction::StopToStart).into(),
            DirectionalTrackRange::new("E", 25., 100., Direction::StopToStart).into(),
        ];
        let path_projection = PathProjection::new(&path);

        let project_path_input = TrainSimulationDetails {
            positions,
            times,
            train_path,
            signal_critical_positions: vec![],
            zone_updates: vec![],
        };

        let space_time_curves = compute_space_time_curves(&project_path_input, &path_projection);
        assert_eq!(space_time_curves.clone().len(), 3);
        let curve = &space_time_curves[0];
        assert_eq!(curve.positions, vec![50_000, 150_000, 250_000, 300_000]);
        assert_eq!(curve.times, vec![0, 10, 20, 25]);

        let curve = &space_time_curves[1];
        assert_eq!(
            curve.positions,
            vec![500_000, 450_000, 400_000, 350_000, 300_000]
        );
        assert_eq!(curve.times, vec![35, 40, 50, 60, 65]);

        let curve = &space_time_curves[2];
        assert_eq!(curve.positions, vec![920_000, 850_000]);
        assert_eq!(curve.times, vec![74, 80]);
    }
}
