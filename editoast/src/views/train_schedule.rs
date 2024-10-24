mod projection;

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::collections::HashSet;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use editoast_authz::BuiltinRole;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use tracing::info;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::pathfinding::PathfindingInputError;
use crate::core::pathfinding::PathfindingNotFound;
use crate::core::pathfinding::PathfindingResultSuccess;
use crate::core::simulation::CompleteReportTrain;
use crate::core::simulation::PhysicsConsistParameters;
use crate::core::simulation::ReportTrain;
use crate::core::simulation::SignalSighting;
use crate::core::simulation::SimulationMargins;
use crate::core::simulation::SimulationPath;
use crate::core::simulation::SimulationPowerRestrictionItem;
use crate::core::simulation::SimulationRequest;
use crate::core::simulation::SimulationResponse;
use crate::core::simulation::SimulationScheduleItem;
use crate::core::simulation::ZoneUpdate;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::infra::Infra;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::views::path::pathfinding::pathfinding_from_train;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::path::PathfindingError;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use crate::RollingStockModel;
use crate::ValkeyClient;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::train_schedule::TrainScheduleBase;

crate::routes! {
    "/train_schedule" => {
        delete,
        "/simulation_summary" => simulation_summary,
        get_batch,
        &projection,
        "/{id}" => {
            get,
            put,
            "/simulation" => simulation,
            "/path" => get_path,
        },
    },
}

editoast_common::schemas! {
    TrainScheduleBase,
    TrainScheduleForm,
    TrainScheduleResult,
    SimulationSummaryResult,
    InfraIdQueryParam,
    ElectricalProfileSetIdQueryParam,
    projection::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule")]
#[allow(clippy::enum_variant_names)] // Variant have the same postfix by chance, it's not a problem
pub enum TrainScheduleError {
    #[error("Train Schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_id: i64 },
    #[error("{number} train schedule(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchTrainScheduleNotFound { number: usize },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

#[derive(IntoParams, Deserialize)]
struct TrainScheduleIdParam {
    /// A train schedule ID
    id: i64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleResult {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    pub train_schedule: TrainScheduleBase,
}

impl From<TrainSchedule> for TrainScheduleResult {
    fn from(value: TrainSchedule) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            train_schedule: TrainScheduleBase {
                train_name: value.train_name,
                labels: value.labels.into_iter().flatten().collect(),
                rolling_stock_name: value.rolling_stock_name,
                start_time: value.start_time,
                schedule: value.schedule,
                margins: value.margins,
                initial_speed: value.initial_speed,
                comfort: value.comfort,
                path: value.path,
                constraint_distribution: value.constraint_distribution,
                speed_limit_tag: value.speed_limit_tag.map(Into::into),
                power_restrictions: value.power_restrictions,
                options: value.options,
            },
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleForm {
    /// Timetable attached to the train schedule
    pub timetable_id: Option<i64>,
    #[serde(flatten)]
    pub train_schedule: TrainScheduleBase,
}

impl From<TrainScheduleForm> for TrainScheduleChangeset {
    fn from(
        TrainScheduleForm {
            timetable_id,
            train_schedule,
        }: TrainScheduleForm,
    ) -> Self {
        Self::from(train_schedule).flat_timetable_id(timetable_id)
    }
}

/// Return a specific train schedule
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainScheduleResult)
    )
)]
async fn get(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    train_schedule_id: Path<TrainScheduleIdParam>,
) -> Result<Json<TrainScheduleResult>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let train_schedule_id = train_schedule_id.id;
    let conn = &mut db_pool.get().await?;

    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(train_schedule.into()))
}

#[derive(Debug, Deserialize, ToSchema)]
struct BatchRequest {
    ids: HashSet<i64>,
}

/// Return a specific train schedule
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(BatchRequest),
    responses(
        (status = 200, description = "Retrieve a list of train schedule", body = Vec<TrainScheduleResult>)
    )
)]
async fn get_batch(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(BatchRequest { ids: train_ids }): Json<BatchRequest>,
) -> Result<Json<Vec<TrainScheduleResult>>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let conn = &mut db_pool.get().await?;
    let train_schedules: Vec<TrainSchedule> =
        TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;
    Ok(Json(train_schedules.into_iter().map_into().collect()))
}

/// Delete a train schedule and its result
#[utoipa::path(
    delete, path = "",
    tag = "timetable,train_schedule",
    request_body = inline(BatchRequest),
    responses(
        (status = 204, description = "All train schedules have been deleted")
    )
)]
async fn delete(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(BatchRequest { ids: train_ids }): Json<BatchRequest>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();

    use crate::models::DeleteBatch;
    let conn = &mut db_pool.get().await?;
    TrainSchedule::delete_batch_or_fail(conn, train_ids, |number| {
        TrainScheduleError::BatchTrainScheduleNotFound { number }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Update  train schedule at once
#[utoipa::path(
    put, path = "",
    tag = "train_schedule,timetable",
    request_body = TrainScheduleForm,
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule have been updated", body = TrainScheduleResult)
    )
)]
async fn put(
    db_pool: State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    train_schedule_id: Path<TrainScheduleIdParam>,
    Json(train_schedule_form): Json<TrainScheduleForm>,
) -> Result<Json<TrainScheduleResult>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    let train_schedule_id = train_schedule_id.id;
    let ts_changeset: TrainScheduleChangeset = train_schedule_form.into();

    let ts_result = ts_changeset
        .update_or_fail(conn, train_schedule_id, || TrainScheduleError::NotFound {
            train_schedule_id,
        })
        .await?;

    Ok(Json(ts_result.into()))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct InfraIdQueryParam {
    infra_id: i64,
}
#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct ElectricalProfileSetIdQueryParam {
    #[param(nullable = false)]
    electrical_profile_set_id: Option<i64>,
}

/// Retrieve the space, speed and time curve of a given train
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(TrainScheduleIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "Simulation Output", body = SimulationResponse),
    ),
)]
async fn simulation(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(train_schedule_id): Path<TrainScheduleIdParam>,
    Query(infra_id_query): Query<InfraIdQueryParam>,
    Query(electrical_profile_set_id_query): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<SimulationResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let valkey_client = app_state.valkey.clone();
    let core_client = app_state.core_client.clone();
    let db_pool = app_state.db_pool_v2.clone();

    let infra_id = infra_id_query.infra_id;
    let electrical_profile_set_id = electrical_profile_set_id_query.electrical_profile_set_id;
    let train_schedule_id = train_schedule_id.id;

    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    // Retrieve train_schedule or fail
    let train_schedule =
        TrainSchedule::retrieve_or_fail(&mut db_pool.get().await?, train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

    Ok(Json(
        train_simulation(
            &mut db_pool.get().await?,
            valkey_client,
            core_client,
            train_schedule,
            &infra,
            electrical_profile_set_id,
        )
        .await?
        .0,
    ))
}

/// Compute simulation of a train schedule
pub async fn train_simulation(
    conn: &mut DbConnection,
    valkey_client: Arc<ValkeyClient>,
    core: Arc<CoreClient>,
    train_schedule: TrainSchedule,
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
) -> Result<(SimulationResponse, PathfindingResult)> {
    Ok(train_simulation_batch(
        conn,
        valkey_client,
        core,
        &[train_schedule],
        infra,
        electrical_profile_set_id,
    )
    .await?
    .pop()
    .unwrap())
}

/// Compute in batch the simulation of a list of train schedule
///
/// Note: The order of the returned simulations is the same as the order of the train schedules.
pub async fn train_simulation_batch(
    conn: &mut DbConnection,
    valkey_client: Arc<ValkeyClient>,
    core: Arc<CoreClient>,
    train_schedules: &[TrainSchedule],
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
) -> Result<Vec<(SimulationResponse, PathfindingResult)>> {
    let mut valkey_conn = valkey_client.get_connection().await?;
    // Compute path
    let (rolling_stocks, _): (Vec<_>, _) = RollingStockModel::retrieve_batch(
        conn,
        train_schedules
            .iter()
            .map::<String, _>(|t| t.rolling_stock_name.clone()),
    )
    .await?;
    let rolling_stocks: HashMap<_, _> = rolling_stocks
        .into_iter()
        .map(|rs| (rs.name.clone(), rs))
        .collect();
    let pathfinding_results = pathfinding_from_train_batch(
        conn,
        &mut valkey_conn,
        core.clone(),
        infra,
        train_schedules,
        &rolling_stocks,
    )
    .await?;

    let mut simulation_results = vec![SimulationResponse::default(); train_schedules.len()];
    let mut to_sim = Vec::with_capacity(train_schedules.len());
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
        let rolling_stock = rolling_stocks[&train_schedule.rolling_stock_name].clone();
        let simulation_request = build_simulation_request(
            infra,
            train_schedule,
            path_item_positions,
            path,
            rolling_stock,
            electrical_profile_set_id,
        );

        // Compute unique hash of the simulation input
        let simulation_hash =
            train_simulation_input_hash(infra.id, &infra.version, &simulation_request);
        to_sim.push((index, simulation_hash, simulation_request));
    }

    let cached_results: Vec<Option<SimulationResponse>> = valkey_conn
        .json_get_bulk(&to_sim.iter().map(|(_, hash, _)| hash).collect::<Vec<_>>())
        .await?;

    let nb_hit = cached_results.iter().flatten().count();
    let nb_miss = to_sim.len() - nb_hit;
    info!(nb_hit, nb_miss, "Hit cache");

    // Compute simulation from core
    let mut futures = Vec::with_capacity(nb_miss);
    let mut futures_index_hash = Vec::with_capacity(nb_miss);
    for ((train_index, train_hash, sim_request), sim_cached) in to_sim.iter().zip(cached_results) {
        if let Some(sim_cached) = sim_cached {
            simulation_results[*train_index] = sim_cached;
            continue;
        }
        futures.push(Box::pin(sim_request.fetch(core.as_ref())));
        futures_index_hash.push((*train_index, train_hash));
    }

    let simulated: Vec<_> = futures::future::join_all(futures)
        .await
        .into_iter()
        .collect();

    let mut is_cacheable = vec![false; train_schedules.len()];
    for (&(train_index, _), sim_res) in futures_index_hash.iter().zip(simulated) {
        (simulation_results[train_index], is_cacheable[train_index]) = match sim_res {
            Ok(sim) => (sim, true),
            // TODO: only make HTTP status code errors non-fatal
            Err(core_error) => (SimulationResponse::SimulationFailed { core_error }, false),
        }
    }

    let to_cache: Vec<_> = futures_index_hash
        .into_iter()
        .filter(|&(train_index, _)| is_cacheable[train_index])
        .map(|(train_index, train_hash)| (train_hash, &simulation_results[train_index]))
        .collect();

    // Cache the simulation response
    valkey_conn.json_set_bulk(&to_cache).await?;

    // Return the response
    Ok(simulation_results
        .into_iter()
        .zip(pathfinding_results)
        .collect())
}

fn build_simulation_request(
    infra: &Infra,
    train_schedule: &TrainSchedule,
    path_item_positions: &[u64],
    path: SimulationPath,
    rolling_stock: RollingStockModel,
    electrical_profile_set_id: Option<i64>,
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
        expected_version: infra.version.clone(),
        path,
        schedule,
        margins,
        initial_speed: train_schedule.initial_speed,
        comfort: train_schedule.comfort,
        constraint_distribution: train_schedule.constraint_distribution,
        speed_limit_tag: train_schedule.speed_limit_tag.clone(),
        power_restrictions,
        options: train_schedule.options.clone(),
        rolling_stock: PhysicsConsistParameters::with_traction_engine(rolling_stock.into()).into(),
        electrical_profile_set_id,
    }
}

// Compute hash input of a simulation
fn train_simulation_input_hash(
    infra_id: i64,
    infra_version: &String,
    simulation_input: &SimulationRequest,
) -> String {
    let osrd_version = get_app_version().unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    simulation_input.hash(&mut hasher);
    let hash_simulation_input = hasher.finish();
    format!("simulation_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
struct SimulationBatchForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    ids: HashSet<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
enum SimulationSummaryResult {
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
    /// An error has occured during pathfinding
    PathfindingFailure { core_error: InternalError },
    /// An error has occured during computing
    SimulationFailed { error_type: String },
    /// InputError
    PathfindingInputError(PathfindingInputError),
}

/// Associate each train id with its simulation summary response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(SimulationBatchForm),
    responses(
        (status = 200, description = "Associate each train id with its simulation summary", body = HashMap<i64, SimulationSummaryResult>),
    ),
)]
async fn simulation_summary(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(SimulationBatchForm {
        infra_id,
        electrical_profile_set_id,
        ids: train_schedule_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, SimulationSummaryResult>>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let conn = &mut db_pool.get().await?;
    let valkey_client = app_state.valkey.clone();
    let core = app_state.core_client.clone();

    let infra = Infra::retrieve_or_fail(conn, infra_id, || TrainScheduleError::InfraNotFound {
        infra_id,
    })
    .await?;
    let train_schedules: Vec<TrainSchedule> =
        TrainSchedule::retrieve_batch_or_fail(conn, train_schedule_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;

    let simulations = train_simulation_batch(
        conn,
        valkey_client,
        core,
        &train_schedules,
        &infra,
        electrical_profile_set_id,
    )
    .await?;

    // Transform simulations to simulation summary
    let mut simulation_summaries = HashMap::new();
    for (train_schedule, sim) in train_schedules.iter().zip(simulations) {
        let (sim, _) = sim;
        let simulation_summary_result = match sim {
            SimulationResponse::Success {
                final_output,
                provisional,
                base,
                ..
            } => {
                let report = final_output.report_train;
                SimulationSummaryResult::Success {
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
                        SimulationSummaryResult::PathfindingFailure { core_error }
                    }

                    PathfindingFailure::PathfindingInputError(input_error) => {
                        SimulationSummaryResult::PathfindingInputError(input_error)
                    }

                    PathfindingFailure::PathfindingNotFound(not_found) => {
                        SimulationSummaryResult::PathfindingNotFound(not_found)
                    }
                }
            }
            SimulationResponse::SimulationFailed { core_error } => {
                SimulationSummaryResult::SimulationFailed {
                    error_type: core_error.get_type().into(),
                }
            }
        };
        simulation_summaries.insert(train_schedule.id, simulation_summary_result);
    }

    Ok(Json(simulation_summaries))
}

/// Get a path from a trainschedule given an infrastructure id and a train schedule id
#[utoipa::path(
    get, path = "",
    tag = "train_schedule,pathfinding",
    params(TrainScheduleIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "The path", body = PathfindingResult),
        (status = 404, description = "Infrastructure or Train schedule not found")
    )
)]
async fn get_path(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
) -> Result<Json<PathfindingResult>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead, BuiltinRole::TimetableRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let valkey_client = app_state.valkey.clone();
    let core = app_state.core_client.clone();

    let conn = &mut db_pool.get().await?;
    let mut valkey_conn = valkey_client.get_connection().await?;

    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;
    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(
        pathfinding_from_train(conn, &mut valkey_conn, core, &infra, train_schedule).await?,
    ))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::core::mocking::MockingClient;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_simple_train_schedule;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_train_schedule_base;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn train_schedule_get() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;

        let url = format!("/train_schedule/{}", train_schedule.id);
        let request = app.get(&url);

        let response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<TrainScheduleResult>();

        assert_eq!(train_schedule.id, response.id);
        assert_eq!(train_schedule.timetable_id, response.timetable_id);
        assert_eq!(
            train_schedule.initial_speed,
            response.train_schedule.initial_speed
        );
    }

    #[rstest]
    async fn train_schedule_get_batch() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let ts1 = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;
        let ts2 = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;
        let ts3 = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;

        // Should succeed
        let request = app.post("/train_schedule").json(&json!({
            "ids": vec![ts1.id, ts2.id, ts3.id]
        }));
        let response: Vec<TrainScheduleResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 3);
    }

    #[rstest]
    async fn train_schedule_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule_base = simple_train_schedule_base();

        // Insert train_schedule
        let request = app
            .post(format!("/timetable/{}/train_schedule", timetable.id).as_str())
            .json(&json!(vec![train_schedule_base]));

        let response: Vec<TrainScheduleResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
    }

    #[rstest]
    async fn train_schedule_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;

        let request = app
            .delete("/train_schedule/")
            .json(&json!({"ids": vec![train_schedule.id]}));

        let _ = app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = TrainSchedule::exists(&mut pool.get_ok(), train_schedule.id)
            .await
            .expect("Failed to retrieve train_schedule");

        assert!(!exists);
    }

    #[rstest]
    async fn train_schedule_put() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;

        let mut update_train_schedule_base = simple_train_schedule_base();
        update_train_schedule_base.rolling_stock_name = String::from("NEW ROLLING_STOCK");

        let update_train_schedule_form = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: update_train_schedule_base,
        };

        let request = app
            .put(format!("/train_schedule/{}", train_schedule.id).as_str())
            .json(&json!(update_train_schedule_form));

        let response: TrainScheduleResult =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(
            response.train_schedule.rolling_stock_name,
            update_train_schedule_form.train_schedule.rolling_stock_name
        )
    }

    async fn app_infra_id_train_schedule_id_for_simulation_tests() -> (TestApp, i64, i64) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();
        core.stub("/v2/pathfinding/blocks")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({
                "blocks":[],
                "routes": [],
                "track_section_ranges": [],
                "path_item_positions": [0,1,2,3],
                "length": 0,
                "status": "success"
            }))
            .finish();
        core.stub("/v2/standalone_simulation")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({
                "status": "success",
                "base": {
                    "positions": [],
                    "times": [],
                    "speeds": [],
                    "energy_consumption": 0.0,
                    "path_item_times": [0, 1000, 2000, 3000]
                },
                "provisional": {
                    "positions": [],
                    "times": [],
                    "speeds": [],
                    "energy_consumption": 0.0,
                    "path_item_times": [0, 1000, 2000, 3000]
                },
                "final_output": {
                    "positions": [0],
                    "times": [0],
                    "speeds": [],
                    "energy_consumption": 0.0,
                    "path_item_times": [0, 1000, 2000, 3000],
                    "signal_sightings": [],
                    "zone_updates": [],
                    "spacing_requirements": [],
                    "routing_requirements": []
                },
                "mrsp": {
                    "boundaries": [],
                    "values": []
                },
                "electrical_profiles": {
                    "boundaries": [],
                    "values": []
                }
            }))
            .finish();
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let train_schedule_base: TrainScheduleBase = TrainScheduleBase {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule: Changeset<TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: train_schedule_base,
        }
        .into();
        let train_schedule = train_schedule
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");
        (app, small_infra.id, train_schedule.id)
    }

    #[rstest]
    async fn train_schedule_simulation() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_train_schedule_id_for_simulation_tests().await;
        let request = app.get(
            format!(
                "/train_schedule/{}/simulation/?infra_id={}",
                train_schedule_id, infra_id
            )
            .as_str(),
        );
        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn train_schedule_simulation_summary() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_train_schedule_id_for_simulation_tests().await;
        let request = app.post("/train_schedule/simulation_summary").json(&json!({
            "infra_id": infra_id,
            "ids": vec![train_schedule_id],
        }));
        app.fetch(request).assert_status(StatusCode::OK);
    }
}
