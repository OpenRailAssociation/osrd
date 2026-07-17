use chrono::Duration;
use core_client::AsCoreRequest;
use core_client::pathfinding::PathfindingInputError;
use core_client::pathfinding::PathfindingNotFound;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::pathfinding::TrainPath;
use core_client::simulation::CompleteReportTrain;
use core_client::simulation::ElectricalProfiles;
use core_client::simulation::PhysicsConsist;
use core_client::simulation::ReportTrain;
use core_client::simulation::SimulationMargins;
use core_client::simulation::SimulationPowerRestrictionItem;
use core_client::simulation::SimulationScheduleItem;
use core_client::simulation::SimulationSuccess;
use core_client::simulation::SpeedLimitProperties;
use core_client::simulation::StopDetails;
use core_task::PathItemConstraint;
use core_task::PathfindingConsist;
use core_task::SimulationConsist;
use core_task::SimulationTrain;
use core_task::SimulationTrainParameters;
use database::DbConnection;
use itertools::Either;
use itertools::Itertools;
use ordered_float::OrderedFloat;
use schemas::TrainOccurrence;
use schemas::train_schedule::Margins;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PowerRestrictionItem;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::iter;
use std::sync::Arc;
use tracing::Instrument;
use tracing::info;
use uom::si::f64::Velocity;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::views::CoreClient;
use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding::TrainScheduleWithConsist;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::rolling_stock::RollingStockError;
use crate::views::timetable::Infra;
use crate::views::timetable::PathfindingResult;
use crate::views::timetable::PhysicsConsistParameters;
use crate::views::timetable::simulation;
use editoast_models::prelude::*;
use editoast_models::rolling_stock::RollingStock;
use schemas::primitives::NonBlankString;
use schemas::primitives::PositiveDuration;

pub const TRAIN_SIZE_BATCH: usize = 100;

/// Approximate time values from simulations to two seconds.
///
/// Used when computing whether path items respect times and margins of a simulation.
///
/// This value is chosen because core hard-codes a timestep of two seconds for standalone simulations.
const TIME_APPROX_ERROR: Duration = Duration::seconds(2);

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
pub struct SimulationResponseSuccess {
    /// Simulation without any regularity margins
    pub base: ReportTrain,
    /// Simulation that takes into account the regularity margins
    pub provisional: ReportTrain,
    /// Simulation that takes into account the regularity margins and the schedule item times
    #[schema(inline)]
    pub final_output: CompleteReportTrain,
    #[schema(inline)]
    pub mrsp: SpeedLimitProperties,
    #[schema(inline)]
    pub electrical_profiles: ElectricalProfiles,
}

/// Compute whether the simulation response respects the times on each path item.
///
/// # Panics
///
/// This function can panic in the following cases:
/// - the simulation response isn't derived from the given train schedule,
/// - some of the final path item times exceed `i64::MAX`
pub fn path_item_respect_times<T: TrainScheduleLike>(
    path_item_times_final: &[u64],
    train_schedule: &T,
) -> Vec<bool> {
    // Ensure we get meaningful panic messages instead of "index out of bounds"
    assert_eq!(
        path_item_times_final.len(),
        train_schedule.path().len(),
        "the number of path item times must be equal to the number of path items in the train schedule"
    );

    let path_item_id_to_index: HashMap<&NonBlankString, usize> = train_schedule
        .path()
        .iter()
        .enumerate()
        .map(|(i, path_item)| (&path_item.id, i))
        .collect();

    let mut res = vec![true; path_item_times_final.len()];

    for schedule_item in train_schedule.schedule() {
        let Some(arrival): Option<PositiveDuration> = schedule_item.arrival else {
            continue;
        };
        let arrival = Duration::from(arrival);

        let path_item_index = path_item_id_to_index[&schedule_item.at];
        let path_item_time = i64::try_from(path_item_times_final[path_item_index]).unwrap();
        let path_item_time = Duration::milliseconds(path_item_time);

        res[path_item_index] = (path_item_time - arrival).abs() < TIME_APPROX_ERROR;
    }

    res
}

/// Compute whether the simulation response respects the margins on each path item.
///
/// This function assumes items in `train_schedule.schedule()` have increasing
/// indices in `train_schedule.path()` (a property which should uphold for all
/// train schedule editoast produces)...
///
/// # Panics
///
/// This function can panic in the following cases:
/// - the simulation response isn't derived from the given train schedule,
/// - some of the final or provisional path item times exceed `i64::MAX`
pub fn path_item_respect_margins<T: TrainScheduleLike>(
    path_item_times_final: &[u64],
    path_item_times_provisional: &[u64],
    train_schedule: &T,
) -> Vec<bool> {
    // Ensure we get meaningful panic messages instead of "index out of bounds"
    assert_eq!(
        path_item_times_final.len(),
        train_schedule.path().len(),
        "the number of path item times must be equal to the number of path items in the train schedule"
    );
    assert_eq!(
        path_item_times_provisional.len(),
        train_schedule.path().len(),
        "the number of path item times must be equal to the number of path items in the train schedule"
    );

    let margin_boundary_set = train_schedule.margins().boundaries.as_slice();

    let path_item_id_to_index: HashMap<&NonBlankString, usize> = train_schedule
        .path()
        .iter()
        .enumerate()
        .map(|(i, path_item)| (&path_item.id, i))
        .collect();

    let mut res = vec![true; path_item_times_final.len()];

    train_schedule
        .path()
        .first() // unconditionally include, will filter later down
        .map(|first_path_item| &first_path_item.id)
        .into_iter()
        .chain(
            train_schedule
                .schedule()
                .iter()
                .filter(|schedule_item| {
                    schedule_item.arrival.is_some()
                        || margin_boundary_set.contains(&schedule_item.at)
                })
                .map(|schedule_item| &schedule_item.at),
        )
        .chain(
            train_schedule
                .path()
                .last() // unconditionally include, will filter later down
                .map(|last_path_item| &last_path_item.id),
        )
        .tuple_windows()
        .for_each(|(prev_path_item_id, path_item_id)| {
            if prev_path_item_id == path_item_id {
                // Because we unconditionally iterate over the first and last item of the path,
                // in case they are not present in the train schedule, we might end up with
                // prev_path_item and path_item being the same, so we filter this case here.
                return;
            }

            let path_item_index = path_item_id_to_index[path_item_id];
            let path_item_time_final =
                i64::try_from(path_item_times_final[path_item_index]).unwrap();
            let path_item_time_provisional =
                i64::try_from(path_item_times_provisional[path_item_index]).unwrap();

            let prev_path_item_index = path_item_id_to_index[prev_path_item_id];
            let prev_path_item_time_final =
                i64::try_from(path_item_times_final[prev_path_item_index]).unwrap();
            let prev_path_item_time_provisional =
                i64::try_from(path_item_times_provisional[prev_path_item_index]).unwrap();

            let interval_duration_final = path_item_time_final - prev_path_item_time_final;
            let interval_duration_provisional =
                path_item_time_provisional - prev_path_item_time_provisional;
            let margin_diff = interval_duration_final - interval_duration_provisional;

            res[prev_path_item_index] = margin_diff >= -TIME_APPROX_ERROR.num_milliseconds();
        });

    res
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
#[schema(as = SimulationResponse, title_variants)]
pub enum Response {
    Success(SimulationResponseSuccess),
    PathfindingFailed {
        pathfinding_failed: PathfindingFailure,
    },
    SimulationFailed {
        core_error: InternalError,
    },
}

impl Response {
    pub fn simulation_run_time(&self) -> Option<u64> {
        if let Response::Success(SimulationResponseSuccess { provisional, .. }) = self {
            Some(
                *provisional
                    .times
                    .last()
                    .expect("core error: empty simulation result"),
            )
        } else {
            None
        }
    }
}

impl From<core_client::simulation::SimulationSuccess> for SimulationResponseSuccess {
    fn from(response: core_client::simulation::SimulationSuccess) -> Self {
        SimulationResponseSuccess {
            base: response.base,
            provisional: response.provisional,
            final_output: response.final_output,
            mrsp: response.mrsp,
            electrical_profiles: response.electrical_profiles,
        }
    }
}

impl From<core_client::simulation::Response> for Response {
    fn from(response: core_client::simulation::Response) -> Self {
        match response {
            core_client::simulation::Response::Success(simulation_success) => {
                Self::Success(simulation_success.into())
            }
            core_client::simulation::Response::SimulationFailed { core_error } => {
                Self::SimulationFailed {
                    core_error: core_error.into(),
                }
            }
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq, serde::Deserialize))]
#[serde(tag = "status", rename_all = "snake_case")]
#[schema(as = SimulationSummaryResult, title_variants)]
pub enum SummaryResponse {
    /// Minimal information on a simulation's result
    Success {
        /// Length of a path in mm
        length: u64,
        /// Travel time in ms
        time: u64,
        /// Total energy consumption of a train in kWh
        energy_consumption: f64,
        /// Final simulation time for each train schedule path item.
        /// The length of this array is the number of path items in the train schedule used as input for the simulation.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_final: Vec<u64>,
        /// Provisional simulation time for each train schedule path item.
        /// The length of this array is the number of path items in the train schedule used as input for the simulation.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_provisional: Vec<u64>,
        /// Base simulation time for each train schedule path item.
        /// The length of this array is the number of path items in the train schedule used as input for the simulation.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_base: Vec<u64>,
        /// Whether each path item in the train schedule is reached on time.
        /// The length of this array is the number of path items in the train schedule used as input for the simulation.
        /// Important: `true` doesn't mean the path item has been reached *precisely* at the requested time. Instead, it means it reached the path item at an acceptable time.
        path_item_respect_times: Vec<bool>,
        /// Whether the final path times respect the input margins for each train schedule path item.
        /// The length of this array is the number of path items in the train schedule used as input for the simulation.
        /// Important: `true` means the provisional time is acceptable margin-wise, not *precisely* respecting the margin.
        path_item_respect_margins: Vec<bool>,
    },
    /// Pathfinding not found
    PathfindingNotFound(PathfindingNotFound),
    /// An error has occurred during computing
    SimulationFailed { error_type: String },
    /// InputError
    PathfindingInputError(PathfindingInputError),
}

impl SummaryResponse {
    pub fn from_simulation_output(
        simulation_output: &core_task::SimulationOutput,
        train_occurrence: &TrainOccurrence,
    ) -> Self {
        match simulation_output {
            core_task::SimulationOutput::Success(SimulationSuccess {
                base,
                provisional,
                final_output,
                ..
            }) => SummaryResponse::Success {
                length: *final_output.report_train.positions.last().unwrap(),
                time: *final_output.report_train.path_item_times.last().unwrap(),
                energy_consumption: final_output.report_train.energy_consumption,
                path_item_times_final: final_output.report_train.path_item_times.clone(),
                path_item_times_provisional: provisional.path_item_times.clone(),
                path_item_times_base: base.path_item_times.clone(),
                path_item_respect_times: super::simulation::path_item_respect_times(
                    &final_output.report_train.path_item_times,
                    train_occurrence,
                ),
                path_item_respect_margins: super::simulation::path_item_respect_margins(
                    &final_output.report_train.path_item_times,
                    &provisional.path_item_times,
                    train_occurrence,
                ),
            },
            core_task::SimulationOutput::PathfindingFailure(pathfinding_failure) => {
                match PathfindingResult::from(pathfinding_failure.clone()) {
                    PathfindingResult::Success(_pathfinding_result_success) => {
                        unreachable!("simulation only returns errors of pathfinding in this field")
                    }
                    PathfindingResult::Failure(pathfinding_failure) => {
                        SummaryResponse::from(pathfinding_failure)
                    }
                }
            }
        }
    }
}

impl From<PathfindingFailure> for SummaryResponse {
    fn from(pathfinding_failure: PathfindingFailure) -> Self {
        match pathfinding_failure {
            PathfindingFailure::PathfindingInputError(pathfinding_input_error) => {
                SummaryResponse::PathfindingInputError(pathfinding_input_error)
            }
            PathfindingFailure::PathfindingNotFound(pathfinding_not_found) => {
                SummaryResponse::PathfindingNotFound(pathfinding_not_found)
            }
        }
    }
}

/// Compute in batch the simulation of a list of train schedule
///
/// Note: The order of the returned simulations is the same as the order of the train schedules.
#[allow(clippy::too_many_arguments)]
pub async fn train_simulation_ordered_batch<T: TrainScheduleLike + Clone>(
    conn: &mut DbConnection,
    valkey_client: Arc<cache::Client>,
    core: Arc<CoreClient>,
    train_schedules: &[T],
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<(Arc<simulation::Response>, Arc<PathfindingResult>)>> {
    let rolling_stocks_names = train_schedules
        .iter()
        .map::<String, _>(|t| t.rolling_stock_name().to_string());

    let rolling_stocks: HashMap<_, _> = RollingStock::retrieve_batch_with_key_unchecked::<_, _>(
        &mut conn.clone(),
        rolling_stocks_names,
    )
    .await
    .map_err(RollingStockError::from)?;
    let (train_schedules_with_consists, rolling_stock_errors): (Vec<_>, Vec<_>) = train_schedules
        .iter()
        .enumerate()
        // train_schedule_idx is the position of the train schedule in the original input list.
        .partition_map(|(train_schedule_idx, train_schedule)| {
            match rolling_stocks.get(train_schedule.rolling_stock_name()) {
                Some(traction_engine) => Either::Left((
                    train_schedule_idx,
                    TrainScheduleWithConsist {
                        train_schedule: train_schedule.clone(),
                        consist: PhysicsConsistParameters::from_traction_engine(
                            traction_engine.clone().into(),
                        ),
                    },
                )),
                None => Either::Right((
                    train_schedule_idx,
                    train_schedule.rolling_stock_name().to_owned(),
                )),
            }
        });

    let train_batches = train_schedules_with_consists.chunks(TRAIN_SIZE_BATCH);

    let futures: Vec<_> = train_batches
        .zip(iter::repeat(conn.clone()))
        .map(|(chunk, conn)| {
            let valkey_client = valkey_client.clone();
            let core = core.clone();
            let infra = <Infra as Clone>::clone(infra);
            let (train_schedule_idxs, chunk): (Vec<_>, Vec<_>) = chunk.iter().cloned().unzip(); // TODO: avoid cloning the chunk
            let app_version = app_version.map(String::from);
            tokio::spawn(
                async move {
                    consist_train_simulation_batch(
                        &mut conn.clone(),
                        valkey_client.clone(),
                        core.clone(),
                        &infra,
                        &chunk,
                        electrical_profile_set_id,
                        app_version.as_deref(),
                    )
                    .await
                    .map(|v| {
                        v.into_iter()
                            .zip(train_schedule_idxs)
                            .map(|((sim, path), index)| (index, sim, path))
                            .collect_vec()
                    })
                }
                .in_current_span(),
            )
        })
        .collect();

    let results = futures::future::try_join_all(futures).await.unwrap();
    let mut results =
        results
            .into_iter()
            .flatten_ok()
            .chain(rolling_stock_errors.into_iter().map(
                |(train_schedule_idx, rolling_stock_name)| {
                    let pathfinding_failure = PathfindingFailure::PathfindingInputError(
                        PathfindingInputError::RollingStockNotFound { rolling_stock_name },
                    );
                    Ok((
                        train_schedule_idx,
                        Arc::new(simulation::Response::PathfindingFailed {
                            pathfinding_failed: pathfinding_failure.clone(),
                        }),
                        Arc::new(PathfindingResult::Failure(pathfinding_failure)),
                    ))
                },
            ))
            .try_collect::<_, Vec<_>, _>()?;
    // Since train_schedule_idx is the position of the train schedule in the original input list,
    // sorting the results by train_schedule_idx here will guarantee that the results have the same
    // order as the input list of train schedules.
    results.sort_by_key(|(train_schedule_idx, _simulation, _path)| *train_schedule_idx);
    let results = results
        .into_iter()
        .map(|(_train_schedule_idx, simulation, path)| (simulation, path))
        .collect_vec();
    Ok(results)
}

#[tracing::instrument(skip_all, fields(nb_trains = train_schedules_with_consists.len()))]
pub async fn consist_train_simulation_batch<T: TrainScheduleLike>(
    conn: &mut DbConnection,
    valkey_client: Arc<cache::Client>,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules_with_consists: &[TrainScheduleWithConsist<T>],
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<(Arc<simulation::Response>, Arc<PathfindingResult>)>> {
    let mut valkey_conn = valkey_client.get_connection().await?;

    let pathfinding_results = pathfinding_from_train_batch(
        conn.clone(),
        &mut valkey_conn,
        core.clone(),
        infra,
        train_schedules_with_consists,
        app_version,
    )
    .await?;

    let mut simulation_results =
        vec![None::<Arc<simulation::Response>>; train_schedules_with_consists.len()];
    let mut to_sim: HashMap<String, Vec<usize>> = HashMap::default();
    let mut sim_request_map: HashMap<String, core_client::simulation::Request> = HashMap::default();
    for (index, (pathfinding, train_schedule_with_consist)) in pathfinding_results
        .iter()
        .zip(train_schedules_with_consists)
        .enumerate()
    {
        let TrainScheduleWithConsist {
            train_schedule,
            consist,
        } = train_schedule_with_consist;
        let (path, path_item_positions, backtrack_path_items) = match pathfinding.as_ref() {
            PathfindingResult::Success(PathfindingResultSuccess {
                path,
                path_item_positions,
                backtrack_path_items,
                ..
            }) => (path, path_item_positions, backtrack_path_items),
            PathfindingResult::Failure(pathfinding_failed) => {
                simulation_results[index] =
                    Some(Arc::new(simulation::Response::PathfindingFailed {
                        pathfinding_failed: pathfinding_failed.clone(),
                    }));
                continue;
            }
        };

        // Build simulation request
        let simulation_request = build_simulation_request(
            infra,
            train_schedule,
            path_item_positions,
            backtrack_path_items.as_ref(),
            path,
            electrical_profile_set_id,
            PhysicsConsist::from(consist.clone()),
        );

        // Compute unique hash of the simulation input
        let simulation_hash = compute_train_simulation_hash_with_versioning(
            infra.id,
            infra.version,
            &simulation_request,
            app_version,
        );
        to_sim
            .entry(simulation_hash.clone())
            .or_default()
            .push(index);
        sim_request_map
            .entry(simulation_hash)
            .or_insert(simulation_request);
    }
    info!(
        nb_train_schedules = train_schedules_with_consists.len(),
        nb_unique_sim = to_sim.len()
    );
    let cached_simulation_hash = to_sim.keys().collect::<Vec<_>>();
    let cached_results: Vec<Option<Arc<simulation::Response>>> = valkey_conn
        .json_get_bulk(&cached_simulation_hash)
        .await?
        .into_iter()
        .map(|simulation| simulation.map(Arc::new))
        .collect();

    let nb_hit = cached_results.iter().flatten().count();
    let nb_miss = cached_results.len() - nb_hit;
    info!(nb_hit, nb_miss, "Hit cache");

    // Compute simulation from core
    let mut futures = Vec::with_capacity(nb_miss);
    let mut futures_hash = Vec::with_capacity(nb_miss);
    for (train_hash, sim_cached) in cached_simulation_hash.into_iter().zip(cached_results) {
        if let Some(sim_cached) = sim_cached {
            let train_indexes = &to_sim[train_hash];
            for train_index in train_indexes {
                simulation_results[*train_index] = Some(sim_cached.clone());
            }
            continue;
        }
        let sim_request = &sim_request_map[train_hash];
        futures.push(Box::pin(sim_request.fetch(core.as_ref())));
        futures_hash.push(train_hash);
    }

    let simulated = futures::future::join_all(futures).await;

    let mut to_cache = vec![];
    for (train_hash, sim_res) in futures_hash.into_iter().zip(simulated) {
        let train_indexes = &to_sim[train_hash];
        match sim_res {
            Ok(sim_res) => {
                to_cache.push((train_hash.to_string(), sim_res.clone()));
                let sim_res = Arc::new(simulation::Response::from(sim_res));
                train_indexes
                    .iter()
                    .for_each(|index| simulation_results[*index] = Some(sim_res.clone()))
            }

            Err(core_error) => {
                let error: InternalError = core_error.into();
                train_indexes.iter().for_each(|index| {
                    simulation_results[*index] =
                        Some(Arc::new(simulation::Response::SimulationFailed {
                            core_error: error.clone(),
                        }))
                })
            }
        }
    }

    // Cache the simulation response
    valkey_conn.json_set_bulk(to_cache).await?;

    // Return the response
    Ok(simulation_results
        .into_iter()
        .flatten()
        .zip(pathfinding_results)
        .collect())
}

pub fn build_pathfinding_consist(
    physics_consist_parameters: &PhysicsConsistParameters,
    speed_limit_tag: Option<String>,
) -> PathfindingConsist {
    PathfindingConsist {
        loading_gauge: physics_consist_parameters.traction_engine.loading_gauge,
        thermal: physics_consist_parameters
            .traction_engine
            .effort_curves
            .has_thermal_curves(),
        supported_electrifications: physics_consist_parameters
            .traction_engine
            .effort_curves
            .supported_electrification(),
        supported_signaling_systems: physics_consist_parameters
            .traction_engine
            .supported_signaling_systems(),
        maximum_speed: OrderedFloat(
            physics_consist_parameters
                .compute_max_speed()
                .get::<uom::si::velocity::meter_per_second>(),
        ),
        length: physics_consist_parameters
            .compute_length()
            .get::<uom::si::length::millimeter>()
            .round() as u64,
        speed_limit_tag,
    }
}

pub fn build_simulation_train(
    train_occurrence: &schemas::TrainOccurrence,
    physics_consist_parameters: &PhysicsConsistParameters,
    operational_point_cache: &OperationalPointCache,
) -> Result<SimulationTrain, PathfindingFailure> {
    let schemas::TrainOccurrence {
        train_name: _,
        labels: _,
        rolling_stock_name: _,
        start_time: _,
        path,
        schedule,
        margins,
        initial_speed,
        comfort,
        constraint_distribution,
        speed_limit_tag,
        power_restrictions,
        options,
        category: _,
    } = train_occurrence;
    let pathfinding_consist = build_pathfinding_consist(
        physics_consist_parameters,
        speed_limit_tag
            .clone()
            .map(|non_blank_string| non_blank_string.0),
    );
    let simulation_consist =
        SimulationConsist(PhysicsConsist::from(physics_consist_parameters.clone()));
    let simulation_train_parameters = SimulationTrainParameters::new(
        Velocity::new::<uom::si::velocity::meter_per_second>(*initial_speed),
        *constraint_distribution,
        *comfort,
        speed_limit_tag
            .clone()
            .map(|non_blank_string| non_blank_string.0),
        options.clone(),
    );
    let mut simulation_train = SimulationTrain::new(
        simulation_consist,
        pathfinding_consist,
        simulation_train_parameters,
    );

    let track_offsets =
        operational_point_cache.extract_location_from_path_items(&train_occurrence.locations())?;
    let schedule_map = schedule
        .iter()
        .map(|schedule_item @ ScheduleItem { at, .. }| (at, schedule_item))
        .collect::<HashMap<_, _>>();
    for (track_offsets, PathItem { id, .. }) in track_offsets.iter().zip(path) {
        let (at, simulation_schedule_item, can_backtrack) = match schedule_map.get(id) {
            None => (id, core_task::ScheduleItem::pass_by(), false),
            Some(ScheduleItem {
                at,
                arrival,
                stop_for,
                reception_signal,
                can_backtrack,
                ..
            }) => (
                at,
                core_task::ScheduleItem {
                    arrival_at: arrival.as_ref().map(|a| a.num_milliseconds() as u64),
                    stop_for: stop_for.as_ref().map(|s| s.num_milliseconds() as u64),
                    reception_signal: *reception_signal,
                },
                *can_backtrack,
            ),
        };
        simulation_train.push_schedule_item(
            PathItemConstraint {
                path_item_alternatives: track_offsets.to_vec(),
                can_backtrack,
            },
            at.clone(),
            simulation_schedule_item,
        )
    }
    debug_assert!(
        path.len() >= 2,
        "there should be at least 2 path items for a train schedule"
    );
    let at_origin = path.first().map(|path_item| &path_item.id);
    let at_destination = path.last().map(|path_item| &path_item.id);
    debug_assert_eq!(
        margins.boundaries.len() + 1,
        margins.values.len(),
        "there should be one more margin values than margin boundaries which indicate the intervals (origin and destination omitted)"
    );
    itertools::chain!(at_origin, &margins.boundaries, at_destination)
        .tuple_windows()
        .zip(&margins.values)
        .for_each(|((at_from, at_to), margin_value)| {
            simulation_train.set_margin(at_from, at_to, *margin_value);
        });
    power_restrictions.iter().for_each(|power_restriction| {
        simulation_train.set_power_restriction(
            &power_restriction.from,
            &power_restriction.to,
            power_restriction.value.clone(),
        );
    });
    Ok(simulation_train)
}

fn build_simulation_request<T: TrainScheduleLike>(
    infra: &Infra,
    train_schedule: &T,
    path_item_positions: &[u64],
    backtrack_path_items: Option<&Vec<usize>>,
    path: &TrainPath,
    electrical_profile_set_id: Option<i64>,
    physics_consist: PhysicsConsist,
) -> core_client::simulation::Request {
    let path_items_to_position =
        build_path_items_to_position(train_schedule.path(), path_item_positions);
    let schedule = build_sim_schedule_items(
        train_schedule.schedule(),
        &path_items_to_position,
        train_schedule.path(),
        backtrack_path_items,
    );
    let margins = build_sim_margins(train_schedule.margins(), &path_items_to_position);
    let power_restrictions = build_sim_power_restriction_items(
        train_schedule.power_restrictions(),
        &path_items_to_position,
    );
    core_client::simulation::Request {
        infra: infra.id,
        expected_version: infra.version,
        path: path.clone(),
        schedule,
        margins,
        initial_speed: train_schedule.initial_speed(),
        comfort: train_schedule.comfort(),
        constraint_distribution: train_schedule.constraint_distribution(),
        speed_limit_tag: train_schedule.speed_limit_tag().cloned(),
        power_restrictions,
        options: train_schedule.options().clone(),
        physics_consist,
        electrical_profile_set_id,
    }
}

pub fn build_path_items_to_position<'t>(
    path_items: &'t [PathItem],
    path_item_positions: &[u64],
) -> HashMap<&'t schemas::primitives::NonBlankString, u64> {
    assert_eq!(path_item_positions.len(), path_items.len());
    // Project path items to path offset

    path_items
        .iter()
        .map(|p| &p.id)
        .zip(path_item_positions.iter().copied())
        .collect()
}

pub fn build_sim_schedule_items(
    schedule_items: &[ScheduleItem],
    path_items_to_position: &HashMap<&schemas::primitives::NonBlankString, u64>,
    path_items: &[PathItem],
    backtrack_path_item_indexes: Option<&Vec<usize>>,
) -> Vec<SimulationScheduleItem> {
    assert_eq!(path_items_to_position.len(), path_items.len());

    // assert that schedule_items are included in path_items
    let path_item_ids: HashSet<_> = path_items.iter().map(|item| &item.id).collect();
    assert!(
        schedule_items
            .iter()
            .all(|item| path_item_ids.contains(&item.at))
    );

    // assert that backtrack_path_item_indexes are included in schedule_items
    if let Some(backtrack_path_item_indexes) = backtrack_path_item_indexes {
        let schedule_items_ids: HashSet<_> = schedule_items.iter().map(|item| &item.at).collect();
        assert!(
            backtrack_path_item_indexes
                .iter()
                .all(|&index| index < path_items.len()
                    && schedule_items_ids.contains(&path_items[index].id)),
        )
    }

    let schedule_items: HashMap<_, _> = schedule_items
        .iter()
        .map(|schedule_item| (&schedule_item.at, schedule_item))
        .collect();
    let mut is_backtracking = vec![false; path_items.len()];
    backtrack_path_item_indexes
        .unwrap_or(&vec![])
        .iter()
        .for_each(|index| is_backtracking[*index] = true);
    path_items
        .iter()
        .zip(is_backtracking)
        .map(
            |(path_item, is_backtracking)| match schedule_items.get(&path_item.id) {
                None => SimulationScheduleItem {
                    path_offset: path_items_to_position[&path_item.id],
                    arrival: None,
                    stop_details: is_backtracking.then(|| StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking,
                    }),
                },
                Some(schedule_item) => SimulationScheduleItem {
                    path_offset: path_items_to_position[&schedule_item.at],
                    arrival: schedule_item
                        .arrival
                        .as_ref()
                        .map(|t| t.num_milliseconds() as u64),
                    stop_details: schedule_item.stop_for.as_ref().map(|t| StopDetails {
                        duration: t.num_milliseconds() as u64,
                        reception_signal: schedule_item.reception_signal,
                        is_backtracking,
                    }),
                },
            },
        )
        .collect()
}

fn build_sim_margins(
    margins: &Margins,
    path_items_to_position: &HashMap<&schemas::primitives::NonBlankString, u64>,
) -> SimulationMargins {
    SimulationMargins {
        boundaries: margins
            .boundaries
            .iter()
            .map(|at| path_items_to_position[at])
            .collect(),
        values: margins.values.clone(),
    }
}

pub fn build_sim_power_restriction_items(
    power_restrictions: &[PowerRestrictionItem],
    path_items_to_position: &HashMap<&schemas::primitives::NonBlankString, u64>,
) -> Vec<SimulationPowerRestrictionItem> {
    power_restrictions
        .iter()
        .map(|item| SimulationPowerRestrictionItem {
            from: path_items_to_position[&item.from],
            to: path_items_to_position[&item.to],
            value: item.value.clone(),
        })
        .collect()
}

fn compute_train_simulation_hash_with_versioning(
    infra_id: i64,
    infra_version: i64,
    simulation_input: &core_client::simulation::Request,
    app_version: Option<&str>,
) -> String {
    let osrd_version = app_version.unwrap_or("default");
    let mut hasher = DefaultHasher::new();
    simulation_input.hash(&mut hasher);
    let hash_simulation_input = hasher.finish();
    format!("simulation_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use schemas::TrainOccurrence;
    use schemas::train_schedule::ReceptionSignal;

    // Test data
    // The simulation responses contain just enough data to compute
    // `path_items_respect_{times,margins}`.

    fn train_schedule_too_fast() -> TrainOccurrence {
        const JSON: &str = include_str!("tests/train_schedule_too_fast.json");
        serde_json::from_str(JSON).unwrap()
    }

    fn train_schedule_too_fast_on_interval() -> TrainOccurrence {
        const JSON: &str = include_str!("tests/train_schedule_too_fast_on_interval.json");
        serde_json::from_str(JSON).unwrap()
    }

    fn train_schedule_not_honored() -> TrainOccurrence {
        const JSON: &str = include_str!("tests/train_schedule_not_honored.json");
        serde_json::from_str(JSON).unwrap()
    }

    fn train_schedule_honored() -> TrainOccurrence {
        const JSON: &str = include_str!("tests/train_schedule_honored.json");
        serde_json::from_str(JSON).unwrap()
    }

    fn train_schedule_no_schedule() -> TrainOccurrence {
        const JSON: &str = include_str!("tests/train_schedule_no_schedule.json");
        serde_json::from_str(JSON).unwrap()
    }

    fn shallow_sim_too_fast() -> SimulationResponseSuccess {
        SimulationResponseSuccess {
            base: ReportTrain {
                path_item_times: vec![0, 1_444_453, 2_491_479],
                ..Default::default()
            },
            provisional: ReportTrain {
                path_item_times: vec![0, 1_834_414, 3_164_206],
                ..Default::default()
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    path_item_times: vec![0, 1_739_394, 3_069_187],
                    ..Default::default()
                },
                ..Default::default()
            },
            mrsp: Default::default(),
            electrical_profiles: Default::default(),
        }
    }

    fn shallow_sim_too_fast_on_interval() -> SimulationResponseSuccess {
        // Too fast from A to B and from D to E
        // Respects margins from A to C as B to C compensates A to B, too fast on C to E as not compensated
        SimulationResponseSuccess {
            base: ReportTrain {
                path_item_times: vec![0, 100_000, 200_000, 300_000, 400_000],
                ..Default::default()
            },
            provisional: ReportTrain {
                path_item_times: vec![0, 100_000, 200_000, 300_000, 400_000],
                ..Default::default()
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    path_item_times: vec![0, 95_000, 201_000, 301_000, 396_000],
                    ..Default::default()
                },
                ..Default::default()
            },
            mrsp: Default::default(),
            electrical_profiles: Default::default(),
        }
    }

    fn shallow_sim_honored() -> SimulationResponseSuccess {
        SimulationResponseSuccess {
            base: ReportTrain {
                path_item_times: vec![0, 2_186_885],
                ..Default::default()
            },
            provisional: ReportTrain {
                path_item_times: vec![0, 2_186_885],
                ..Default::default()
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    path_item_times: vec![0, 2_186_885],
                    ..Default::default()
                },
                ..Default::default()
            },
            mrsp: Default::default(),
            electrical_profiles: Default::default(),
        }
    }

    fn shallow_sim_not_honored() -> SimulationResponseSuccess {
        SimulationResponseSuccess {
            base: ReportTrain {
                path_item_times: vec![0, 1_425_534, 2_186_885],
                ..Default::default()
            },
            provisional: ReportTrain {
                path_item_times: vec![0, 1_425_534, 2_186_885],
                ..Default::default()
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    path_item_times: vec![0, 1_425_534, 2_186_885],
                    ..Default::default()
                },
                ..Default::default()
            },
            mrsp: Default::default(),
            electrical_profiles: Default::default(),
        }
    }

    #[test]
    fn test_too_fast() {
        let schedule = train_schedule_too_fast();
        let sim = shallow_sim_too_fast();
        let respect = path_item_respect_margins(
            &sim.final_output.report_train.path_item_times,
            &sim.provisional.path_item_times,
            &schedule,
        );
        assert_eq!(*respect, [false, true, true]);
    }

    #[test]
    fn test_too_fast_on_interval() {
        let schedule = train_schedule_too_fast_on_interval();
        let sim = shallow_sim_too_fast_on_interval();
        let respect = path_item_respect_margins(
            &sim.final_output.report_train.path_item_times,
            &sim.provisional.path_item_times,
            &schedule,
        );
        assert_eq!(*respect, [true, true, false, true, true]);
    }

    #[test]
    fn test_not_too_fast_if_honored() {
        let schedule = train_schedule_honored();
        let sim = shallow_sim_honored();
        let respect = path_item_respect_margins(
            &sim.final_output.report_train.path_item_times,
            &sim.provisional.path_item_times,
            &schedule,
        );
        assert_eq!(*respect, [true, true]);
    }

    #[test]
    fn test_times_honored() {
        let schedule = train_schedule_honored();
        let sim = shallow_sim_honored();
        let respect: Vec<bool> =
            path_item_respect_times(&sim.final_output.report_train.path_item_times, &schedule);
        assert_eq!(*respect, [true, true]);
    }

    #[test]
    fn test_times_no_schedule() {
        let schedule = train_schedule_no_schedule();
        let sim = shallow_sim_honored();
        let respect: Vec<bool> =
            path_item_respect_times(&sim.final_output.report_train.path_item_times, &schedule);
        assert_eq!(*respect, [true, true]);
    }

    #[test]
    fn test_times_not_honored() {
        let schedule = train_schedule_not_honored();
        let sim = shallow_sim_not_honored();
        let respect: Vec<bool> =
            path_item_respect_times(&sim.final_output.report_train.path_item_times, &schedule);
        assert_eq!(*respect, [true, false, true]);
    }

    #[test]
    fn test_build_simulation_schedule() {
        let train_schedule = train_schedule_honored();
        let path_item_positions: [u64; 2] = [0, 3000];
        let path_items_to_position =
            build_path_items_to_position(train_schedule.path(), &path_item_positions);
        let simulation_schedule_items = build_sim_schedule_items(
            &train_schedule.schedule,
            &path_items_to_position,
            train_schedule.path(),
            None,
        );
        assert_eq!(
            simulation_schedule_items,
            [
                SimulationScheduleItem {
                    path_offset: 0,
                    arrival: None,
                    stop_details: None
                },
                SimulationScheduleItem {
                    path_offset: 3000,
                    arrival: None,
                    stop_details: Some(StopDetails {
                        duration: 0,
                        reception_signal: ReceptionSignal::Open,
                        is_backtracking: false,
                    })
                }
            ]
        );
    }
}
