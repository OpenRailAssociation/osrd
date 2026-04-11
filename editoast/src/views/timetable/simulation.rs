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
use core_client::simulation::SpeedLimitProperties;
use database::DbConnection;
use itertools::Itertools;
use schemas::train_schedule::Margins;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PowerRestrictionItem;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::iter;
use std::sync::Arc;
use tracing::Instrument;
use tracing::info;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::views::CoreClient;
use crate::views::path::pathfinding::PathfindingFailure;
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
#[schema(as = SimulationResponse)]
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
#[schema(as = SimulationSummaryResult)]
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
    /// An error has occurred during pathfinding
    PathfindingFailure { core_error: InternalError },
    /// An error has occurred during computing
    SimulationFailed { error_type: String },
    /// InputError
    PathfindingInputError(PathfindingInputError),
}

impl SummaryResponse {
    pub fn summarize_simulation<T: TrainScheduleLike>(
        response: simulation::Response,
        train_schedule: &T,
    ) -> Self {
        match response {
            simulation::Response::Success(sim) => {
                let path_item_respect_times = path_item_respect_times(
                    &sim.final_output.report_train.path_item_times,
                    train_schedule,
                );
                let path_item_respect_margins = path_item_respect_margins(
                    &sim.final_output.report_train.path_item_times,
                    &sim.provisional.path_item_times,
                    train_schedule,
                );

                let SimulationResponseSuccess {
                    final_output: CompleteReportTrain { report_train, .. },
                    provisional,
                    base,
                    ..
                } = sim;

                Self::Success {
                    length: *report_train.positions.last().unwrap(),
                    time: *report_train.path_item_times.last().unwrap(),
                    energy_consumption: report_train.energy_consumption,
                    path_item_times_final: report_train.path_item_times,
                    path_item_times_provisional: provisional.path_item_times,
                    path_item_times_base: base.path_item_times.clone(),
                    path_item_respect_times,
                    path_item_respect_margins,
                }
            }
            simulation::Response::PathfindingFailed { pathfinding_failed } => {
                match pathfinding_failed {
                    PathfindingFailure::InternalError { core_error } => {
                        Self::PathfindingFailure { core_error }
                    }

                    PathfindingFailure::PathfindingInputError(input_error) => {
                        Self::PathfindingInputError(input_error)
                    }

                    PathfindingFailure::PathfindingNotFound(not_found) => {
                        Self::PathfindingNotFound(not_found)
                    }
                }
            }
            simulation::Response::SimulationFailed { core_error } => Self::SimulationFailed {
                error_type: core_error.error_type,
            },
        }
    }
}

/// Compute in batch the simulation of a list of train schedule
///
/// Note: The order of the returned simulations is the same as the order of the train schedules.
#[allow(clippy::too_many_arguments)]
pub async fn train_simulation_batch<T: TrainScheduleLike>(
    conn: &mut DbConnection,
    valkey_client: Arc<cache::Client>,
    core: Arc<CoreClient>,
    train_schedules: &[T],
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<(Arc<simulation::Response>, Arc<PathfindingResult>)>> {
    // Compute path

    let train_batches = train_schedules.chunks(TRAIN_SIZE_BATCH);

    let rolling_stocks_ids = train_schedules
        .iter()
        .map::<String, _>(|t| t.rolling_stock_name().to_string());

    let rolling_stocks: Vec<_> =
        RollingStock::retrieve_batch_unchecked(&mut conn.clone(), rolling_stocks_ids)
            .await
            .map_err(RollingStockError::from)?;

    let consists: Vec<PhysicsConsistParameters> = rolling_stocks
        .into_iter()
        .map(|rs| PhysicsConsistParameters::from_traction_engine(rs.into()))
        .collect();

    let futures: Vec<_> = train_batches
        .zip(iter::repeat(conn.clone()))
        .map(|(chunk, conn)| {
            let valkey_client = valkey_client.clone();
            let core = core.clone();
            let consists = consists.clone();
            let infra = <Infra as Clone>::clone(infra);
            let chunk = chunk.to_vec(); // TODO: avoid cloning the chunk
            let app_version = app_version.map(String::from);
            tokio::spawn(
                async move {
                    consist_train_simulation_batch(
                        &mut conn.clone(),
                        valkey_client.clone(),
                        core.clone(),
                        &infra,
                        &chunk,
                        &consists,
                        electrical_profile_set_id,
                        app_version.as_deref(),
                    )
                    .await
                }
                .in_current_span(),
            )
        })
        .collect();

    let results = futures::future::try_join_all(futures).await.unwrap();
    results
        .into_iter()
        .flatten_ok()
        .collect::<Result<Vec<_>, _>>()
}

#[tracing::instrument(skip_all, fields(nb_trains = train_schedules.len()))]
#[allow(clippy::too_many_arguments)]
pub async fn consist_train_simulation_batch<T: TrainScheduleLike>(
    conn: &mut DbConnection,
    valkey_client: Arc<cache::Client>,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules: &[T],
    consists: &[PhysicsConsistParameters],
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<(Arc<simulation::Response>, Arc<PathfindingResult>)>> {
    let mut valkey_conn = valkey_client.get_connection().await?;

    let pathfinding_results = pathfinding_from_train_batch(
        conn.clone(),
        &mut valkey_conn,
        core.clone(),
        infra,
        train_schedules,
        &consists
            .iter()
            .map(|consist| consist.traction_engine.clone())
            .collect::<Vec<_>>(),
        app_version,
    )
    .await?;

    let consists: HashMap<_, _> = consists
        .iter()
        .map(|consist| (consist.traction_engine.name.as_str(), consist))
        .collect();

    let mut simulation_results = vec![None::<Arc<simulation::Response>>; train_schedules.len()];
    let mut to_sim: HashMap<String, Vec<usize>> = HashMap::default();
    let mut sim_request_map: HashMap<String, core_client::simulation::Request> = HashMap::default();
    for (index, (pathfinding, train_schedule)) in
        pathfinding_results.iter().zip(train_schedules).enumerate()
    {
        let (path, path_item_positions) = match pathfinding.as_ref() {
            PathfindingResult::Success(PathfindingResultSuccess {
                path,
                path_item_positions,
                ..
            }) => (path, path_item_positions),
            PathfindingResult::Failure(pathfinding_failed) => {
                simulation_results[index] =
                    Some(Arc::new(simulation::Response::PathfindingFailed {
                        pathfinding_failed: pathfinding_failed.clone(),
                    }));
                continue;
            }
        };

        // Build simulation request
        let physics_consist_parameters = consists[train_schedule.rolling_stock_name()].clone();

        let simulation_request = build_simulation_request(
            infra,
            train_schedule,
            path_item_positions,
            path,
            electrical_profile_set_id,
            physics_consist_parameters.into(),
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
        nb_train_schedules = train_schedules.len(),
        nb_unique_sim = to_sim.len()
    );
    let cached_simulation_hash = to_sim.keys().collect::<Vec<_>>();
    let cached_results: Vec<Option<Arc<simulation::Response>>> = valkey_conn
        .compressed_get_bulk(&cached_simulation_hash)
        .await?
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
                to_cache.push((train_hash, sim_res.clone()));
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
    valkey_conn.compressed_set_bulk(&to_cache).await?;

    // Return the response
    Ok(simulation_results
        .into_iter()
        .flatten()
        .zip(pathfinding_results)
        .collect())
}

fn build_simulation_request<T: TrainScheduleLike>(
    infra: &Infra,
    train_schedule: &T,
    path_item_positions: &[u64],
    path: &TrainPath,
    electrical_profile_set_id: Option<i64>,
    physics_consist: PhysicsConsist,
) -> core_client::simulation::Request {
    let path_items_to_position =
        build_path_items_to_position(train_schedule.path(), path_item_positions);
    let schedule = build_sim_schedule_items(train_schedule.schedule(), &path_items_to_position);
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
        path_item_positions: path_item_positions.to_vec(),
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
) -> Vec<SimulationScheduleItem> {
    schedule_items
        .iter()
        .map(|schedule_item| SimulationScheduleItem {
            path_offset: path_items_to_position[&schedule_item.at],
            arrival: schedule_item
                .arrival
                .as_ref()
                .map(|t| t.num_milliseconds() as u64),
            stop_for: schedule_item
                .stop_for
                .as_ref()
                .map(|t| t.num_milliseconds() as u64),
            reception_signal: schedule_item.reception_signal,
        })
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
}
