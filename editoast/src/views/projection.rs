use crate::error::Result;
use core_client::CoreClient;
use core_client::pathfinding::TrackRange;
use core_client::simulation::CompleteReportTrain;
use core_client::simulation::ReportTrain;
use database::DbConnection;
use editoast_derive::EditoastError;
use itertools::Itertools;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;
use thiserror::Error;
use utoipa::ToSchema;

use super::path::operational_point_cache::OperationalPointCache;

use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::path::projection::TrackLocationFromPath;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::train_simulation_ordered_batch;
use editoast_models::Infra;

#[derive(Debug, Deserialize, ToSchema)]
pub struct ProjectPathForm {
    pub infra_id: i64,
    pub timetable_id: i64,
    pub electrical_profile_set_id: Option<i64>,
    pub ids: HashSet<i64>,
    #[schema(inline, value_type = Vec<core_client::pathfinding::TrackRange>)]
    pub track_section_ranges: Vec<TrackRange>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ProjectPathOperationalPointForm {
    pub infra_id: i64,
    pub timetable_id: i64,
    pub electrical_profile_set_id: Option<i64>,
    pub train_ids: HashSet<i64>,
    #[schema(inline)]
    pub operational_points_refs: Vec<OperationalPointReference>,
    /// Distances between operational points in mm
    pub operational_points_distances: Vec<u64>,
    pub use_simulation: bool,
}

#[derive(Default, Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct SpaceTimeCurve {
    /// List of positions of a train in mm
    /// Both positions and times must have the same length
    #[schema(min_items = 1)]
    positions: Vec<u64>,
    /// List of times in ms since `departure_time` associated to a position
    #[schema(min_items = 1)]
    times: Vec<u64>,
}

impl SpaceTimeCurve {
    /// Push a point to the space time curve.
    /// If the point is already present, it is not added again.
    fn push_point(&mut self, position: u64, time: u64) {
        if self.positions.last().zip(self.times.last()) == Some((&position, &time)) {
            // If the point is already in the curve, do not add it again
            return;
        }
        self.positions.push(position);
        self.times.push(time);
    }

    /// Push a stop (two points) to the space time curve.
    /// If the stop is already present, it is not added again.
    /// If `stop_for` is 0, equivalent to `push_point`.
    fn push_stop(&mut self, position: u64, time: u64, stop_for: u64) {
        if self.positions.last().zip(self.times.last()) == Some((&position, &(time + stop_for))) {
            // If the point is already in the curve, do not add it again
            return;
        }
        self.positions.push(position);
        self.times.push(time);
        if stop_for != 0 {
            self.positions.push(position);
            self.times.push(time + stop_for);
        }
    }

    /// Check if the space time curve is empty
    fn is_empty(&self) -> bool {
        self.positions.is_empty()
    }

    /// Generic linear interpolation function
    /// For a segmented curve going through the points `(x[i],y[i])` find its Y
    /// coordinate at the given X coordinate `value`. If `value` is out of bounds
    /// return the first or the last point of the curve.
    /// Expects `x` to be sorted.
    /// Panics if the curve is empty or if x and y have different lengths
    fn linear_interpolate_curve(x: &[u64], y: &[u64], value: u64) -> u64 {
        assert_eq!(x.len(), y.len(), "Curve x and y must have the same length");
        assert!(!x.is_empty(), "Curve can't be empty");

        if value > x[x.len() - 1] {
            // If the value is greater than the last x, return the last y
            return y[y.len() - 1];
        }
        // Find the index of the last x equal or greater than value
        let index = find_index_upper(x, value);
        if index == 0 {
            // If the index is 0, return the first y
            return y[0];
        }
        // Interpolate between the two points
        linear_interpolate(x[index - 1], x[index], y[index - 1], y[index], value)
    }

    /// Find the position at a given time
    /// Panics if the curve is empty
    fn linear_interpolate_time(&self, time: u64) -> u64 {
        Self::linear_interpolate_curve(&self.times, &self.positions, time)
    }

    /// Find the time at a given position
    /// Panics if the curve is empty
    fn linear_interpolate_position(&self, position: u64) -> u64 {
        Self::linear_interpolate_curve(&self.positions, &self.times, position)
    }
}

/// Input for the projection of a train schedule on a path
#[derive(Debug, Clone, Hash)]
pub struct TrainSimulationDetails {
    pub positions: Vec<u64>,
    pub times: Vec<u64>,
    pub train_path: Vec<TrackRange>,
}

impl TrainSimulationDetails {
    // Compute hash input of the projection of a train schedule on a path
    pub fn compute_projection_hash_with_versioning(
        &self,
        infra_id: i64,
        infra_version: i64,
        path_projection_tracks: &[TrackRange],
        app_version: Option<&str>,
    ) -> String {
        let osrd_version = app_version.unwrap_or_default();
        let mut hasher = DefaultHasher::new();
        self.positions.hash(&mut hasher);
        self.times.hash(&mut hasher);
        self.train_path.hash(&mut hasher);
        path_projection_tracks.hash(&mut hasher);
        let hash_simulation_input = hasher.finish();
        format!("projection_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
    }
}

/// Compute the space time curves of a train schedule on a path
fn compute_space_time_curves(
    project_path_input: &TrainSimulationDetails,
    path_projection: &PathProjection,
) -> Vec<SpaceTimeCurve> {
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
        let start_index = find_index_lower(positions, start);
        let end_index = find_index_upper(positions, end);

        // Each segment contains the start, end and all positions between them
        // We must interpolate the start and end positions if they are not part of the positions
        let mut segment_positions = Vec::with_capacity(end_index - start_index + 2);
        let mut segment_times = Vec::with_capacity(end_index - start_index + 2);
        // Interpolate the first point of the segment
        segment_positions.push(project_pos(start, &train_path, path_projection));
        segment_times.push(linear_interpolate(
            positions[start_index],
            positions[start_index + 1],
            times[start_index],
            times[start_index + 1],
            start,
        ));

        // Project all the points in the segment
        for index in (start_index + 1)..end_index {
            segment_positions.push(project_pos(positions[index], &train_path, path_projection));
            segment_times.push(times[index]);
        }

        // Interpolate the last point of the segment
        segment_positions.push(project_pos(end, &train_path, path_projection));
        // The interpolation is inverted because we want to retrieve the higher time if positions[end_index] == positions[end_index - 1]
        segment_times.push(linear_interpolate(
            positions[end_index],
            positions[end_index - 1],
            times[end_index],
            times[end_index - 1],
            end,
        ));
        space_time_curves.push(SpaceTimeCurve {
            positions: segment_positions,
            times: segment_times,
        });
    }
    space_time_curves
}

/// Find the index of the first element greater than a value.
/// In case it matches duplicate values, it returns the rightmost index.
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

/// Find the index of the first element lower than a value.
/// In case it matches duplicate values, it returns the leftmost index.
///
/// **Values must be sorted in ascending order**
///
/// ## Panics
///
/// - If value is greater than the last element of values.
/// - If values is empty
pub fn find_index_lower(values: &[u64], value: u64) -> usize {
    let mut index = find_index_upper(values, value);
    while index > 0
        && (values[index] > value || (values[index] == value && values[index - 1] == values[index]))
    {
        index -= 1;
    }
    index
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

/// Linear interpolation between two points `a` and `b` given their x and y coordinates.
/// Note: If `a_x` is equal to `b_x`, it returns `a_y`.
///
/// Panics if `x` is not between `a_x` and `b_x`.
pub fn linear_interpolate(a_x: u64, b_x: u64, a_y: u64, b_y: u64, x: u64) -> u64 {
    if a_x == b_x {
        a_y
    } else if a_y < b_y && a_x < b_x {
        a_y + (x - a_x) * (b_y - a_y) / (b_x - a_x)
    } else if a_y >= b_y && a_x < b_x {
        a_y - (x - a_x) * (a_y - b_y) / (b_x - a_x)
    } else if a_y < b_y && a_x >= b_x {
        a_y + (a_x - x) * (b_y - a_y) / (a_x - b_x)
    } else {
        a_y - (a_x - x) * (a_y - b_y) / (a_x - b_x)
    }
}

/// Interpolates the arrival time at a given position using simulation output.
///
/// This function finds the position in the train's trajectory and interpolates
/// the arrival time based on the surrounding positions and times.
pub fn interpolate_arrival_time(position: u64, report_train: &ReportTrain) -> i64 {
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
    time as i64
}

#[allow(clippy::too_many_arguments)]
pub async fn compute_projected_train_paths<T: TrainScheduleLike>(
    conn: &mut DbConnection,
    core_client: Arc<CoreClient>,
    valkey_client: Arc<cache::Client>,
    track_section_ranges: Vec<TrackRange>,
    infra: &Infra,
    train_schedules: &[T],
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<Arc<Vec<SpaceTimeCurve>>>> {
    let path_projection = PathProjection::new(&track_section_ranges);
    let mut valkey_conn = valkey_client.get_connection().await?;

    // 1. Get train simulations
    let simulations = train_simulation_ordered_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        train_schedules,
        infra,
        electrical_profile_set_id,
        app_version,
    )
    .await?;

    // 2. Extracts train simulation details and computes unique hashes for projected train paths.
    let trains_details = extract_train_details(simulations, train_schedules).await;

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
                        app_version,
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
        .json_get_bulk::<_, Vec<SpaceTimeCurve>>(&train_hashes)
        .await?;

    let mut projection_request_map: HashMap<String, TrainSimulationDetails> = HashMap::new();
    let mut project_path_result: Vec<Arc<Vec<SpaceTimeCurve>>> =
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
    valkey_conn.json_set_bulk(space_time_curves.clone()).await?;

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

#[derive(Clone, Debug)]
pub struct OperationalPointRefAndTime {
    /// Arrival time of the train at this operational point
    arrival_time: u64,
    /// The stop duration at this operational point (0 if it does not stop)
    stop_for: u64,
    op_ref: OperationalPointReference,
}

#[derive(Debug, Default)]
pub struct TrainToProjectOnOperationalPoint {
    space_time_curve: Option<SpaceTimeCurve>,
    refs: Vec<OperationalPointRefAndTime>,
}

impl TrainToProjectOnOperationalPoint {
    /// Only use the train schedule to build the projection input
    fn new_from_input<T: TrainScheduleLike>(ts: &T) -> Self {
        let stops_input: HashMap<_, _> = ts
            .schedule()
            .iter()
            .filter_map(|schedule| {
                schedule
                    .stop_for
                    .as_ref()
                    .map(|stop_for| (&schedule.at, stop_for.num_milliseconds() as u64))
            })
            .collect();

        // Handle non-simulated trains
        let arrival_inputs = ts
            .schedule()
            .iter()
            .filter_map(|schedule| {
                schedule
                    .arrival
                    .as_ref()
                    .map(|arrival| (&schedule.at, arrival.num_milliseconds() as u64))
            })
            .collect::<HashMap<_, _>>();

        let mut refs = ts.path().iter().map(|path_item| match &path_item.location {
            PathItemLocation::OperationalPointPartReference(op_ref) => {
                Some((&op_ref.operational_point, &path_item.id))
            }
            PathItemLocation::TrackOffset(_) => None,
        });

        let first_path_item = refs.next().flatten();

        let refs = refs.flatten().map(|(op_ref, id)| {
            arrival_inputs
                .get(&id)
                .map(|&arrival_time| OperationalPointRefAndTime {
                    arrival_time,
                    stop_for: stops_input.get(&id).copied().unwrap_or_default(),
                    op_ref: op_ref.clone(),
                })
        });

        let first_op_ref = first_path_item.map(|(op_ref, id)| OperationalPointRefAndTime {
            arrival_time: 0,
            stop_for: stops_input.get(&id).copied().unwrap_or_default(),
            op_ref: op_ref.clone(),
        });

        let refs = std::iter::once(first_op_ref)
            .chain(refs)
            .flatten()
            .collect();

        TrainToProjectOnOperationalPoint {
            space_time_curve: None,
            refs,
        }
    }

    /// Case where the train doesn't respect their time
    ///
    /// We draw the space-time curve first using inputs, then using the simulation from the
    /// last scheduled point to the destination.
    fn new_from_invalid<T: TrainScheduleLike>(
        ts: &T,
        sim: SimulationResponseSuccess,
        path: core_client::pathfinding::PathfindingResult,
    ) -> Self {
        // Reuse the space-time curve from the track projection, so that scheduled
        // `PathItemLocation::TrackOffset`s are visible on the STD even for invalid trains.
        let space_time_curve = extract_curve_for_invalid_train_with_sim(ts, &sim, &path);

        let last_path_item_id = &ts.path().last().unwrap().id;
        let first_path_item_id = &ts.path().first().unwrap().id;

        // Contrary to the input-only projection, we only want to take into account all stops.
        let stops_input: HashMap<_, _> = ts
            .schedule()
            .iter()
            .filter(|schedule| {
                &schedule.at == last_path_item_id
                    || &schedule.at == first_path_item_id
                    || schedule.arrival.is_some()
            })
            .filter_map(|schedule| {
                Some((&schedule.at, schedule.stop_for?.num_milliseconds() as u64))
            })
            .collect();

        let refs = ts
            .path()
            .iter()
            .zip(path.path_item_positions)
            .filter_map(
                |(path_item, path_item_position)| match &path_item.location {
                    PathItemLocation::OperationalPointPartReference(op_ref) => {
                        let arrival_time =
                            space_time_curve.linear_interpolate_position(path_item_position);
                        Some(OperationalPointRefAndTime {
                            arrival_time,
                            stop_for: stops_input.get(&path_item.id).copied().unwrap_or_default(),
                            op_ref: op_ref.operational_point.clone(),
                        })
                    }
                    _ => None,
                },
            )
            .collect();

        Self {
            space_time_curve: Some(space_time_curve),
            refs,
        }
    }

    /// Use the train simulation to build the projection input
    fn new_from_simulation<T: TrainScheduleLike>(
        ts: &T,
        sim: simulation::Response,
        path: PathfindingResult,
    ) -> Self {
        let simulation::Response::Success(sim) = sim else {
            return Self::new_from_input(ts);
        };
        let PathfindingResult::Success(path) = path else {
            return Self::new_from_input(ts);
        };
        let respect_times =
            simulation::path_item_respect_times(&sim.final_output.report_train.path_item_times, ts)
                .into_iter()
                .all(|path_item| path_item);
        if !respect_times {
            return Self::new_from_invalid(ts, sim, path);
        }

        let stops_input: HashMap<_, _> = ts
            .schedule()
            .iter()
            .filter_map(|schedule| {
                schedule
                    .stop_for
                    .as_ref()
                    .map(|stop_for| (&schedule.at, stop_for.num_milliseconds() as u64))
            })
            .collect();
        let CompleteReportTrain { report_train, .. } = sim.final_output;
        let space_time_curve = Some(SpaceTimeCurve {
            positions: report_train.positions,
            times: report_train.times,
        });
        let refs = ts
            .path()
            .iter()
            .zip(report_train.path_item_times)
            .flat_map(|(path_item, arrival_time)| match &path_item.location {
                PathItemLocation::OperationalPointPartReference(op_ref) => {
                    Some(OperationalPointRefAndTime {
                        arrival_time,
                        stop_for: stops_input.get(&path_item.id).copied().unwrap_or_default(),
                        op_ref: op_ref.operational_point.clone(),
                    })
                }
                PathItemLocation::TrackOffset(_) => None,
            })
            .collect();
        Self {
            space_time_curve,
            refs,
        }
    }
}

#[derive(Debug, Default)]
pub struct OperationalPointProjection(HashMap<OperationalPointReference, u64>);

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "operationalPointProjection", default_status = 422)]
pub enum OperationalPointProjectionError {
    #[error("Expected {expected} distances, but got {found}")]
    InvalidNumberOfDistances { expected: usize, found: usize },
    #[error("Expected at least two refs")]
    InvalidNumberOfRefs,
}

impl OperationalPointProjection {
    pub fn new(
        op_refs: Vec<OperationalPointReference>,
        distances: Vec<u64>,
        op_cache: &OperationalPointCache,
    ) -> Result<Self, OperationalPointProjectionError> {
        if op_refs.len() < 2 {
            return Err(OperationalPointProjectionError::InvalidNumberOfRefs);
        }
        if op_refs.len() != distances.len() + 1 {
            return Err(OperationalPointProjectionError::InvalidNumberOfDistances {
                expected: op_refs.len() - 1,
                found: distances.len(),
            });
        }
        // Transform operational point references into a list of operational point ids if it exists
        // Otherwise, keep the original operational point references
        let op_refs = op_refs
            .into_iter()
            .map(|op_ref| {
                op_cache.get_op_ref_id(&op_ref).map_or(op_ref, |op_id| {
                    OperationalPointReference::Id {
                        operational_point: op_id.into(),
                    }
                })
            })
            .collect::<Vec<_>>();

        Ok(Self(
            op_refs
                .into_iter()
                .zip(std::iter::once(0).chain(distances).scan(0, |acc, i| {
                    *acc += i;
                    Some(*acc)
                }))
                .collect(),
        ))
    }

    /// Try to match an operational point reference.
    /// If it matches, the position is returned.
    /// Otherwise, it returns `None`.
    fn match_op_ref_with_ops(
        &self,
        op_ref: &OperationalPointReference,
        op_cache: &OperationalPointCache,
    ) -> Option<u64> {
        let op_id = op_cache
            .get_op_ref_id(op_ref)
            .map(|op_id| OperationalPointReference::Id {
                operational_point: op_id.into(),
            });

        if let Some(op_id) = op_id {
            self.0.get(&op_id).copied()
        } else {
            self.0.get(op_ref).copied()
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn compute_projected_train_path_op<T: TrainScheduleLike>(
    conn: &mut DbConnection,
    valkey_client: Arc<cache::Client>,
    core_client: Arc<CoreClient>,
    train_schedules: &[T],
    op_cache: &OperationalPointCache,
    operational_points_projection: OperationalPointProjection,
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<Arc<Vec<SpaceTimeCurve>>>> {
    let simulations = train_simulation_ordered_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        train_schedules,
        infra,
        electrical_profile_set_id,
        app_version,
    )
    .await?;

    struct ComputeContext<'a, T> {
        indexes: Vec<usize>,
        train_schedule: &'a T,
        simulation: simulation::Response,
        pathfinding: PathfindingResult,
    }

    let mut to_compute = HashMap::new();
    for ((idx, train_schedule), (simulation, pathfinding)) in
        train_schedules.iter().enumerate().zip(simulations)
    {
        to_compute
            .entry(Arc::as_ptr(&simulation))
            .or_insert(ComputeContext {
                indexes: vec![],
                train_schedule,
                simulation: Arc::unwrap_or_clone(simulation),
                pathfinding: Arc::unwrap_or_clone(pathfinding),
            })
            .indexes
            .push(idx);
    }

    let mut results = vec![Arc::default(); train_schedules.len()];
    for context in to_compute.into_values() {
        let train_to_project = TrainToProjectOnOperationalPoint::new_from_simulation(
            context.train_schedule,
            context.simulation,
            context.pathfinding,
        );
        let curves = Arc::new(project_train_path_op(
            &train_to_project,
            op_cache,
            &operational_points_projection,
        ));

        for index in context.indexes {
            results[index] = curves.clone();
        }
    }

    Ok(results)
}

fn project_train_path_op(
    TrainToProjectOnOperationalPoint {
        space_time_curve,
        refs,
    }: &TrainToProjectOnOperationalPoint,
    op_cache: &OperationalPointCache,
    projection_op_id_to_positions: &OperationalPointProjection,
) -> Vec<SpaceTimeCurve> {
    // Match operational point references with operational point ids
    let matching_ops = refs.iter().map(|op| {
        projection_op_id_to_positions
            .match_op_ref_with_ops(&op.op_ref, op_cache)
            .map(|pos| (pos, op.arrival_time, op.stop_for))
    });

    // Add a None at the end to close the last segment
    let matching_ops = matching_ops.chain(std::iter::once(None));

    // Iterate over the matching operations and build the projection curves
    let mut projection_curves = vec![];
    let mut curve = SpaceTimeCurve::default(); // The current curve being built
    for (a, b) in matching_ops.tuple_windows() {
        match (a, b) {
            (Some((a_pos, a_time, a_stop_for)), Some((b_pos, b_time, b_stop_for))) => {
                curve.push_stop(a_pos, a_time, a_stop_for);
                if let Some(space_time_curve) = &space_time_curve {
                    // Add interpolated points between a and b
                    let index_begin = find_index_upper(&space_time_curve.times, a_time);
                    let index_end = find_index_upper(&space_time_curve.times, b_time);
                    let start = space_time_curve.linear_interpolate_time(a_time);
                    let end = space_time_curve.linear_interpolate_time(b_time);
                    let range = index_begin..index_end;
                    for (&time, &position) in space_time_curve.times[range.clone()]
                        .iter()
                        .zip(&space_time_curve.positions[range])
                    {
                        let inter_pos = linear_interpolate(start, end, a_pos, b_pos, position);
                        curve.push_point(inter_pos, time);
                    }
                }
                curve.push_stop(b_pos, b_time, b_stop_for);
            }
            (None, Some((b_pos, b_time, b_stop_for))) => {
                if !curve.is_empty() {
                    // Save and reset the curve for the next segment
                    projection_curves.push(curve);
                    curve = SpaceTimeCurve::default();
                }
                curve.push_stop(b_pos, b_time, b_stop_for);
            }
            (Some((a_pos, a_time, a_stop_for)), None) => {
                curve.push_stop(a_pos, a_time, a_stop_for);
                // Save and reset the curve for the next segment
                projection_curves.push(curve);
                curve = SpaceTimeCurve::default();
            }
            (None, None) => continue,
        }
    }
    projection_curves
}

pub fn compute_projected_train_path_op_without_simulation<T: TrainScheduleLike>(
    train_schedules: &[T],
    op_cache: &OperationalPointCache,
    operational_points_projection: OperationalPointProjection,
) -> Vec<Arc<Vec<SpaceTimeCurve>>> {
    train_schedules
        .iter()
        .map(|train_schedule| {
            let train_to_project = TrainToProjectOnOperationalPoint::new_from_input(train_schedule);
            Arc::new(project_train_path_op(
                &train_to_project,
                op_cache,
                &operational_points_projection,
            ))
        })
        .collect_vec()
}

/// Extract space time curve for train that does not respect their times
/// These trains have path and simulation information that we can use.
fn extract_curve_for_invalid_train_with_sim<T: TrainScheduleLike>(
    train_schedule: &T,
    sim: &SimulationResponseSuccess,
    path: &core_client::pathfinding::PathfindingResult,
) -> SpaceTimeCurve {
    let mut positions = vec![0];
    let mut times = vec![0];
    let mut last_scheduled_time = 0;
    let schedule_map = train_schedule
        .schedule()
        .iter()
        .map(|s| (&s.at, s))
        .collect::<HashMap<_, _>>();

    for (path_item, path_item_position) in
        train_schedule.path().iter().zip(&path.path_item_positions)
    {
        let Some(ScheduleItem {
            arrival: Some(arrival),
            stop_for,
            ..
        }) = schedule_map.get(&path_item.id)
        else {
            continue;
        };
        last_scheduled_time = arrival.num_milliseconds() as u64;
        positions.push(*path_item_position);
        times.push(last_scheduled_time);
        if let Some(stop_for) = stop_for {
            positions.push(*path_item_position);
            times.push((arrival.num_milliseconds() + stop_for.num_milliseconds()) as u64);
        }
    }

    // If the schedule has no arrival time for the last path item, so we cannot
    // draw the final straight segment from schedule data alone. At the last schedule position,
    // we compute the time offset between the simulation curve and the scheduled time.
    // Then we draw the last segment (with its optional stop).
    let last_scheduled_position = *positions.last().unwrap();
    if last_scheduled_position != path.length {
        let sim_curve = SpaceTimeCurve {
            positions: sim.final_output.report_train.positions.clone(),
            times: sim.final_output.report_train.times.clone(),
        };
        let last_sim_time = sim_curve.linear_interpolate_position(last_scheduled_position);
        // Can't use times.last() because of possible stops at the end
        let diff_time = last_scheduled_time as i64 - last_sim_time as i64;

        let nb_points_to_ignore =
            find_index_lower(&sim_curve.positions, *sim_curve.positions.last().unwrap());
        sim_curve
            .positions
            .into_iter()
            .zip(sim_curve.times)
            .skip(nb_points_to_ignore)
            .for_each(|(position, time)| {
                positions.push(position);
                times.push((time as i64 + diff_time) as u64);
            });
    }
    SpaceTimeCurve { positions, times }
}

pub async fn extract_train_details<T: TrainScheduleLike>(
    simulations: Vec<(Arc<simulation::Response>, Arc<PathfindingResult>)>,
    train_schedules: &[T],
) -> Vec<Option<TrainSimulationDetails>> {
    assert_eq!(train_schedules.len(), simulations.len());

    simulations
        .into_iter()
        .zip(train_schedules)
        .map(|((sim, pathfinding_result), train_schedule)| {
            let PathfindingResult::Success(pathfinding_result) = pathfinding_result.as_ref() else {
                return None;
            };
            let simulation::Response::Success(sim) = sim.as_ref() else {
                return None;
            };
            let respect_times = simulation::path_item_respect_times(
                &sim.final_output.report_train.path_item_times,
                train_schedule,
            )
            .into_iter()
            .all(|path_item| path_item);

            let curve = if respect_times {
                SpaceTimeCurve {
                    positions: sim.final_output.report_train.positions.clone(),
                    times: sim.final_output.report_train.times.clone(),
                }
            } else {
                extract_curve_for_invalid_train_with_sim(train_schedule, sim, pathfinding_result)
            };

            Some(TrainSimulationDetails {
                positions: curve.positions,
                times: curve.times,
                train_path: pathfinding_result.path.track_section_ranges.clone(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::create_small_infra;
    use crate::views::test_app;
    use rstest::rstest;
    use schemas::infra::Direction;
    use schemas::infra::DirectionalTrackRange;
    use schemas::primitives::Identifier;
    use schemas::train_schedule::OperationalPointPartReference;
    use schemas::train_schedule::PathItemLocation;

    #[rstest]
    #[case(1, 0)]
    #[case(2, 1)]
    #[case(3, 2)]
    #[case(4, 3)]
    #[case(5, 5)]
    #[case(6, 6)]
    #[case(7, 6)]
    #[case(8, 7)]
    #[case(9, 9)]
    fn test_find_index_upper(#[case] value: u64, #[case] expected: usize) {
        let values = vec![1, 3, 3, 4, 5, 5, 7, 8, 9, 9];
        assert_eq!(find_index_upper(&values, value), expected);
    }

    #[rstest]
    #[case(1, 0)]
    #[case(2, 0)]
    #[case(3, 1)]
    #[case(4, 3)]
    #[case(5, 4)]
    #[case(6, 5)]
    #[case(7, 6)]
    #[case(8, 7)]
    #[case(9, 8)]
    fn test_find_index_lower(#[case] value: u64, #[case] expected: usize) {
        let values = vec![1, 3, 3, 4, 5, 5, 7, 8, 9, 9];
        assert_eq!(find_index_lower(&values, value), expected);
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

        let result = interpolate_arrival_time(position, &report_train);

        assert_eq!(result, expected_time);
    }

    #[test]
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

    #[test]
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
        };

        let space_time_curves = compute_space_time_curves(&project_path_input, &path_projection);
        assert_eq!(space_time_curves.clone().len(), 1);
        let curve = &space_time_curves[0];
        assert_eq!(curve.positions, positions);
        assert_eq!(curve.times, times);
    }

    #[test]
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

    fn create_path_item_from_trigram(trigram: &str) -> OperationalPointReference {
        OperationalPointReference::Trigram {
            trigram: trigram.into(),
            secondary_code: Some("BV".into()),
        }
    }

    fn create_path_items_from_trigrams(trigrams: &[&str]) -> Vec<PathItemLocation> {
        trigrams
            .iter()
            .map(|&trigram| {
                PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                    operational_point: create_path_item_from_trigram(trigram),
                    local_track_name: None,
                })
            })
            .collect()
    }

    impl OperationalPointRefAndTime {
        fn new_trigram(arrival_time: u64, stop_for: u64, trigram: &str) -> Self {
            OperationalPointRefAndTime {
                arrival_time,
                stop_for,
                op_ref: create_path_item_from_trigram(trigram),
            }
        }
    }

    impl Default for OperationalPointRefAndTime {
        fn default() -> Self {
            OperationalPointRefAndTime {
                arrival_time: 0,
                stop_for: 0,
                op_ref: OperationalPointReference::Id {
                    operational_point: Identifier::default(),
                },
            }
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_simple_project_train_path_op() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let trigrams = ["SWS", "MWS", "MES", "NS", "SS"];
        let path_items = create_path_items_from_trigrams(&trigrams);
        let op_cache =
            OperationalPointCache::load_path_items(db_pool.get_ok(), small_infra.id, &path_items)
                .await
                .expect("Failed to load operational point cache");
        // Train
        let train_to_project_on_op = TrainToProjectOnOperationalPoint {
            space_time_curve: Some(SpaceTimeCurve {
                times: vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40],
                positions: vec![
                    0, 100, 250, 250, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000,
                ],
            }),
            refs: vec![
                OperationalPointRefAndTime::new_trigram(0, 0, "SWS"),
                OperationalPointRefAndTime::new_trigram(10, 0, "MWS"),
                OperationalPointRefAndTime::new_trigram(19, 0, "MES"),
                OperationalPointRefAndTime::new_trigram(35, 2, "NS"),
            ],
        };
        // Manchette
        let projection_op_id_to_positions = OperationalPointProjection::new(
            vec![
                create_path_item_from_trigram("SWS"),
                create_path_item_from_trigram("MWS"),
                create_path_item_from_trigram("MES"),
                create_path_item_from_trigram("NS"),
                create_path_item_from_trigram("SS"),
            ],
            vec![100_000; 4],
            &op_cache,
        )
        .expect("Failed to create operational point projection");

        // Run tested function
        let curves = project_train_path_op(
            &train_to_project_on_op,
            &op_cache,
            &projection_op_id_to_positions,
        );

        // Check results
        assert_eq!(curves.len(), 1);
        assert_eq!(
            curves[0].times,
            vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 30, 35, 37]
        );
        assert_eq!(
            curves[0].positions,
            vec![
                0, 10000, 25000, 25000, 40000, 50000, 60000, 70000, 80000, 90000, 100000, 200000,
                206250, 268750, 300000, 300000
            ]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_simple_reverse_project_train_path_op() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let trigrams = ["SWS", "MWS", "MES", "NS", "SS"];
        let path_items = create_path_items_from_trigrams(&trigrams);
        let op_cache =
            OperationalPointCache::load_path_items(db_pool.get_ok(), small_infra.id, &path_items)
                .await
                .expect("Failed to load operational point cache");
        // Train
        let train_to_project_on_op = TrainToProjectOnOperationalPoint {
            space_time_curve: Some(SpaceTimeCurve {
                times: vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40],
                positions: vec![
                    0, 100, 250, 250, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000,
                ],
            }),
            refs: vec![
                OperationalPointRefAndTime::new_trigram(0, 0, "NS"),
                OperationalPointRefAndTime::new_trigram(10, 0, "MES"),
                OperationalPointRefAndTime::new_trigram(19, 0, "MWS"),
                OperationalPointRefAndTime::new_trigram(35, 0, "SWS"),
            ],
        };
        // Manchette
        let projection_op_id_to_positions = OperationalPointProjection::new(
            vec![
                create_path_item_from_trigram("SWS"),
                create_path_item_from_trigram("MWS"),
                create_path_item_from_trigram("MES"),
                create_path_item_from_trigram("NS"),
                create_path_item_from_trigram("SS"),
            ],
            vec![100_000; 4],
            &op_cache,
        )
        .expect("Failed to create operational point projection");

        // Run tested function
        let curves = project_train_path_op(
            &train_to_project_on_op,
            &op_cache,
            &projection_op_id_to_positions,
        );

        // Check results
        assert_eq!(curves.len(), 1);
        assert_eq!(
            curves[0].times,
            vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 30, 35]
        );

        assert_eq!(
            curves[0].positions,
            vec![
                300000, 290000, 275000, 275000, 260000, 250000, 240000, 230000, 220000, 210000,
                200000, 100000, 93750, 31250, 0
            ]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_points_project_train_path_op() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let trigrams = ["SWS", "MWS", "MES", "NS", "SS"];
        let path_items = create_path_items_from_trigrams(&trigrams);
        let op_cache =
            OperationalPointCache::load_path_items(db_pool.get_ok(), small_infra.id, &path_items)
                .await
                .expect("Failed to load operational point cache");
        // Train
        let train_to_project_on_op = TrainToProjectOnOperationalPoint {
            space_time_curve: None,
            refs: vec![
                OperationalPointRefAndTime::new_trigram(0, 1, "SWS"),
                OperationalPointRefAndTime::default(),
                OperationalPointRefAndTime::new_trigram(10, 0, "MWS"),
                OperationalPointRefAndTime::new_trigram(21, 3, "MES"),
                OperationalPointRefAndTime::default(),
                OperationalPointRefAndTime::new_trigram(28, 0, "NS"),
                OperationalPointRefAndTime::default(),
                OperationalPointRefAndTime::new_trigram(35, 1, "SS"),
            ],
        };
        // Manchette
        let projection_op_id_to_positions = OperationalPointProjection::new(
            vec![
                create_path_item_from_trigram("SWS"),
                create_path_item_from_trigram("MWS"),
                create_path_item_from_trigram("MES"),
                create_path_item_from_trigram("NS"),
                create_path_item_from_trigram("SS"),
            ],
            vec![100_000; 4],
            &op_cache,
        )
        .expect("Failed to create operational point projection");

        // Run tested function
        let curves = project_train_path_op(
            &train_to_project_on_op,
            &op_cache,
            &projection_op_id_to_positions,
        );

        // Check results
        assert_eq!(curves.len(), 4);
        assert_eq!(curves[0].times, vec![0, 1]);
        assert_eq!(curves[0].positions, vec![0, 0]);
        assert_eq!(curves[1].times, vec![10, 21, 24]);
        assert_eq!(curves[1].positions, vec![100000, 200000, 200000]);
        assert_eq!(curves[2].times, vec![28]);
        assert_eq!(curves[2].positions, vec![300_000]);
        assert_eq!(curves[3].times, vec![35, 36]);
        assert_eq!(curves[3].positions, vec![400_000, 400_000]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_no_matching_points_project_train_path_op() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let op_cache = OperationalPointCache::load_path_items::<PathItemLocation>(
            db_pool.get_ok(),
            small_infra.id,
            &[],
        )
        .await
        .expect("Failed to load operational point cache");
        // Train
        let train_to_project_on_op = TrainToProjectOnOperationalPoint {
            space_time_curve: None,
            refs: vec![OperationalPointRefAndTime::default(); 4],
        };
        // Manchette
        let projection_op_id_to_positions = OperationalPointProjection::new(
            vec![
                create_path_item_from_trigram("SWS"),
                create_path_item_from_trigram("MWS"),
                create_path_item_from_trigram("MES"),
                create_path_item_from_trigram("NS"),
                create_path_item_from_trigram("SS"),
            ],
            vec![100_000; 4],
            &op_cache,
        )
        .expect("Failed to create operational point projection");

        // Run tested function
        let curves = project_train_path_op(
            &train_to_project_on_op,
            &op_cache,
            &projection_op_id_to_positions,
        );

        // Check results
        assert_eq!(curves.len(), 0);
    }
}
