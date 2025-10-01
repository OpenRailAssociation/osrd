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
use crate::models::RollingStock;
use crate::views::CoreClient;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::rolling_stock::RollingStockError;
use crate::views::timetable::Infra;
use crate::views::timetable::PathfindingResult;
use crate::views::timetable::PhysicsConsistParameters;
use crate::views::timetable::simulation;
use editoast_models::prelude::*;

pub const TRAIN_SIZE_BATCH: usize = 100;

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
pub struct SimulationResponseSuccess {
    /// Simulation without any regularity margins
    pub base: ReportTrain,
    /// Simulation that takes into account the regularity margins
    pub provisional: ReportTrain,
    #[schema(inline)]
    /// User-selected simulation: can be base or provisional
    pub final_output: CompleteReportTrain,
    #[schema(inline)]
    pub mrsp: SpeedLimitProperties,
    #[schema(inline)]
    pub electrical_profiles: ElectricalProfiles,
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
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_final: Vec<u64>,
        /// Provisional simulation time for each train schedule path item.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_provisional: Vec<u64>,
        /// Base simulation time for each train schedule path item.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_base: Vec<u64>,
        /// The path offset in mm of each path item given as input of the pathfinding
        /// The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm
        path_item_positions: Vec<u64>,
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
    pub fn summarize_simulation(response: simulation::Response, path: PathfindingResult) -> Self {
        match response {
            simulation::Response::Success(SimulationResponseSuccess {
                final_output,
                provisional,
                base,
                ..
            }) => {
                let PathfindingResult::Success(PathfindingResultSuccess {
                    path_item_positions,
                    ..
                }) = path
                else {
                    panic!("Pathfinding cannnot fail if the simulation has succeeded")
                };
                let report = final_output.report_train;
                Self::Success {
                    length: *report.positions.last().unwrap(),
                    time: *report.path_item_times.last().unwrap(),
                    energy_consumption: report.energy_consumption,
                    path_item_times_final: report.path_item_times.clone(),
                    path_item_times_provisional: provisional.path_item_times.clone(),
                    path_item_times_base: base.path_item_times.clone(),
                    path_item_positions: path_item_positions.clone(),
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
