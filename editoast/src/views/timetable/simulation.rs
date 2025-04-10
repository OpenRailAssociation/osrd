use crate::RetrieveBatchUnchecked;
use crate::ValkeyClient;
use crate::core;
use crate::core::AsCoreRequest;
use crate::core::pathfinding::PathfindingInputError;
use crate::core::pathfinding::PathfindingNotFound;
use crate::core::pathfinding::PathfindingResultSuccess;
use crate::core::simulation::PhysicsConsist;
use crate::core::simulation::PhysicsConsistParameters;
use crate::core::simulation::SimulationMargins;
use crate::core::simulation::SimulationPath;
use crate::core::simulation::SimulationPowerRestrictionItem;
use crate::core::simulation::SimulationRequest;
use crate::core::simulation::SimulationScheduleItem;
use crate::error::Result;
use crate::models;
use crate::models::RollingStockModel;
use crate::views::CoreClient;
use crate::views::InternalError;
use crate::views::SimulationResponse;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::timetable::Infra;
use crate::views::timetable::PathfindingResult;
use editoast_models::DbConnection;
use itertools::Itertools;
use serde::Serialize;
use std::collections::HashMap;
use std::iter;
use std::sync::Arc;
use tracing::Instrument;
use tracing::info;
use utoipa::ToSchema;

pub const TRAIN_SIZE_BATCH: usize = 100;

editoast_common::schemas! {
    SimulationSummaryResult,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq, serde::Deserialize))]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum SimulationSummaryResult {
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

impl From<core::simulation::SimulationResponse> for SimulationSummaryResult {
    fn from(sim: SimulationResponse) -> Self {
        match sim {
            SimulationResponse::Success {
                final_output,
                provisional,
                base,
                ..
            } => {
                let report = final_output.report_train;
                Self::Success {
                    length: *report.positions.last().unwrap(),
                    time: *report.times.last().unwrap(),
                    energy_consumption: report.energy_consumption,
                    path_item_times_final: report.path_item_times.clone(),
                    path_item_times_provisional: provisional.path_item_times.clone(),
                    path_item_times_base: base.path_item_times.clone(),
                }
            }
            SimulationResponse::PathfindingFailed { pathfinding_failed } => {
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
            SimulationResponse::SimulationFailed { core_error } => Self::SimulationFailed {
                error_type: core_error.error_type,
            },
        }
    }
}

/// Compute in batch the simulation of a list of train schedule
///
/// Note: The order of the returned simulations is the same as the order of the train schedules.
pub async fn train_simulation_batch(
    conn: &mut DbConnection,
    valkey_client: Arc<ValkeyClient>,
    core: Arc<CoreClient>,
    train_schedules: &[models::TrainSchedule],
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
) -> Result<Vec<(SimulationResponse, PathfindingResult)>> {
    // Compute path

    let train_batches = train_schedules.chunks(TRAIN_SIZE_BATCH);

    let rolling_stocks_ids = train_schedules
        .iter()
        .map::<String, _>(|t| t.rolling_stock_name.clone());

    let rolling_stocks: Vec<_> =
        RollingStockModel::retrieve_batch_unchecked(&mut conn.clone(), rolling_stocks_ids).await?;

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
            let chunk = chunk.to_vec();
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
pub async fn consist_train_simulation_batch(
    conn: &mut DbConnection,
    valkey_client: Arc<ValkeyClient>,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules: &[models::TrainSchedule],
    consists: &[PhysicsConsistParameters],
    electrical_profile_set_id: Option<i64>,
) -> Result<Vec<(SimulationResponse, PathfindingResult)>> {
    let mut valkey_conn = valkey_client.get_connection().await?;

    let pathfinding_results = pathfinding_from_train_batch(
        conn,
        &mut valkey_conn,
        core.clone(),
        infra,
        train_schedules,
        &consists
            .iter()
            .map(|consist| consist.traction_engine.clone())
            .collect::<Vec<_>>(),
    )
    .await?;

    let consists: HashMap<_, _> = consists
        .iter()
        .map(|consist| (&consist.traction_engine.name, consist))
        .collect();

    let mut simulation_results = vec![SimulationResponse::default(); train_schedules.len()];
    let mut to_sim: HashMap<String, Vec<usize>> = HashMap::default();
    let mut sim_request_map: HashMap<String, SimulationRequest> = HashMap::default();
    for (index, (pathfinding, train_schedule)) in
        pathfinding_results.iter().zip(train_schedules).enumerate()
    {
        let (path, path_item_positions) = match pathfinding {
            PathfindingResult::Success(PathfindingResultSuccess {
                blocks,
                routes,
                track_section_ranges,
                path_item_positions,
                ..
            }) => (
                SimulationPath {
                    blocks: blocks.clone(),
                    routes: routes.clone(),
                    track_section_ranges: track_section_ranges.clone(),
                    path_item_positions: path_item_positions.clone(),
                },
                path_item_positions,
            ),
            PathfindingResult::Failure(pathfinding_failed) => {
                simulation_results[index] = SimulationResponse::PathfindingFailed {
                    pathfinding_failed: pathfinding_failed.clone(),
                };
                continue;
            }
        };

        // Build simulation request
        let physics_consist_parameters = consists[&train_schedule.rolling_stock_name].clone();

        let simulation_request = build_simulation_request(
            infra,
            train_schedule,
            path_item_positions,
            path,
            electrical_profile_set_id,
            physics_consist_parameters.into(),
        );

        // Compute unique hash of the simulation input
        let simulation_hash = simulation_request
            .compute_train_simulation_hash_with_versioning(infra.id, infra.version);
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
    let cached_results: Vec<Option<SimulationResponse>> = valkey_conn
        .compressed_get_bulk(&cached_simulation_hash)
        .await?;

    let nb_hit = cached_results.iter().flatten().count();
    let nb_miss = to_sim.len() - nb_hit;
    info!(nb_hit, nb_miss, "Hit cache");

    // Compute simulation from core
    let mut futures = Vec::with_capacity(nb_miss);
    let mut futures_hash = Vec::with_capacity(nb_miss);
    for (train_hash, sim_cached) in cached_simulation_hash.iter().zip(cached_results) {
        if let Some(sim_cached) = sim_cached {
            let train_indexes = &to_sim[*train_hash];
            for train_index in train_indexes {
                simulation_results[*train_index] = sim_cached.clone();
            }
            continue;
        }
        let sim_request = &sim_request_map[*train_hash];
        futures.push(Box::pin(sim_request.fetch(core.as_ref())));
        futures_hash.push(train_hash);
    }

    let simulated: Vec<_> = futures::future::join_all(futures)
        .await
        .into_iter()
        .collect();

    let mut to_cache = vec![];
    for (train_hash, sim_res) in futures_hash.iter().zip(simulated) {
        let train_indexes = &to_sim[**train_hash];
        match sim_res {
            Ok(sim_res) => {
                to_cache.push((train_hash, sim_res.clone()));
                train_indexes
                    .iter()
                    .for_each(|index| simulation_results[*index] = sim_res.clone())
            }

            Err(core_error) => {
                let error: InternalError = core_error.into();
                train_indexes.iter().for_each(|index| {
                    simulation_results[*index] = SimulationResponse::SimulationFailed {
                        core_error: error.clone(),
                    }
                })
            }
        }
    }

    // Cache the simulation response
    valkey_conn.compressed_set_bulk(&to_cache).await?;

    // Return the response
    Ok(simulation_results
        .into_iter()
        .zip(pathfinding_results)
        .collect())
}

fn build_simulation_request(
    infra: &Infra,
    train_schedule: &models::TrainSchedule,
    path_item_positions: &[u64],
    path: SimulationPath,
    electrical_profile_set_id: Option<i64>,
    physics_consist: PhysicsConsist,
) -> SimulationRequest {
    assert_eq!(path_item_positions.len(), train_schedule.path.len());
    // Project path items to path offset
    let path_items_to_position: HashMap<_, _> = train_schedule
        .path
        .iter()
        .map(|p| &p.id)
        .zip(path_item_positions.iter().copied())
        .collect();

    let schedule = train_schedule
        .schedule
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
        .collect();

    let margins = SimulationMargins {
        boundaries: train_schedule
            .margins
            .boundaries
            .iter()
            .map(|at| path_items_to_position[at])
            .collect(),
        values: train_schedule.margins.values.clone(),
    };

    let power_restrictions = train_schedule
        .power_restrictions
        .iter()
        .map(|item| SimulationPowerRestrictionItem {
            from: path_items_to_position[&item.from],
            to: path_items_to_position[&item.to],
            value: item.value.clone(),
        })
        .collect();

    SimulationRequest {
        infra: infra.id,
        expected_version: infra.version,
        path,
        schedule,
        margins,
        initial_speed: train_schedule.initial_speed,
        comfort: train_schedule.comfort,
        constraint_distribution: train_schedule.constraint_distribution,
        speed_limit_tag: train_schedule.speed_limit_tag.clone(),
        power_restrictions,
        options: train_schedule.options.clone(),
        physics_consist,
        electrical_profile_set_id,
    }
}
