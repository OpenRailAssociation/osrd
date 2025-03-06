use std::collections::HashMap;
use std::collections::HashSet;
use std::iter;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::train_schedule::TrainScheduleBase;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use tracing::info;
use tracing::Instrument;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::projection::compute_projected_train_paths;
use super::projection::ProjectPathForm;
use super::SimulationSummaryResult;
use crate::core::pathfinding::PathfindingResultSuccess;
use crate::core::simulation::PhysicsConsist;
use crate::core::simulation::PhysicsConsistParameters;
use crate::core::simulation::SimulationMargins;
use crate::core::simulation::SimulationPath;
use crate::core::simulation::SimulationPowerRestrictionItem;
use crate::core::simulation::SimulationRequest;
use crate::core::simulation::SimulationResponse;
use crate::core::simulation::SimulationScheduleItem;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::infra::Infra;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::views::path::pathfinding::pathfinding_from_train;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::path::PathfindingError;
use crate::views::projection::ProjectPathTrainResult;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::InfraIdQueryParam;
use crate::views::ListId;
use crate::AppState;
use crate::RollingStockModel;
use crate::ValkeyClient;

crate::routes! {
    "/train_schedule" => {
        delete,
        "/project_path" => project_path,
        "/simulation_summary" => simulation_summary,
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
    ElectricalProfileSetIdQueryParam,
}

pub const TRAIN_SIZE_BATCH: usize = 100;

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
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
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
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
) -> Result<Json<TrainScheduleResult>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(train_schedule.into()))
}

/// Delete a train schedule and its result
#[utoipa::path(
    delete, path = "",
    tag = "timetable,train_schedule",
    request_body = inline(ListId),
    responses(
        (status = 204, description = "All train schedules have been deleted")
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(ListId { ids: train_ids }): Json<ListId>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Json(train_schedule_form): Json<TrainScheduleForm>,
) -> Result<Json<TrainScheduleResult>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
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
    State(AppState {
        valkey: valkey_client,
        core_client,
        db_pool,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<SimulationResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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

    // Compute simulation of a train schedule
    let (simulation, _) = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client,
        core_client,
        &[train_schedule],
        &infra,
        electrical_profile_set_id,
    )
    .await?
    .pop()
    .unwrap();

    Ok(Json(simulation))
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
    train_schedules: &[TrainSchedule],
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
            .compute_train_simulation_hash_with_versioning(infra.id, &infra.version);
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
    train_schedule: &TrainSchedule,
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
        physics_consist,
        electrical_profile_set_id,
    }
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
struct SimulationBatchForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    ids: HashSet<i64>,
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
    State(AppState {
        db_pool,
        valkey: valkey_client,
        core_client: core,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(SimulationBatchForm {
        infra_id,
        electrical_profile_set_id,
        ids: train_schedule_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, SimulationSummaryResult>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

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
        let simulation_summary_result = SimulationSummaryResult::from(sim);
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
    State(AppState {
        db_pool,
        valkey: valkey_client,
        core_client: core,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
) -> Result<Json<PathfindingResult>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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

/// Projects the space time curves and paths of a number of train schedules onto a given path
///
/// - Returns 404 if the infra or any of the train schedules are not found
/// - Returns 200 with a hashmap of train_id to ProjectPathTrainResult
///
/// Train schedules that are invalid (pathfinding or simulation failed) are not included in the result
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = ProjectPathForm,
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<i64, ProjectPathTrainResult>),
    ),
)]
async fn project_path(
    State(AppState {
        db_pool,
        valkey: valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(ProjectPathForm {
        infra_id,
        ids: train_ids,
        path,
        electrical_profile_set_id,
    }): Json<ProjectPathForm>,
) -> Result<Json<HashMap<i64, ProjectPathTrainResult>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let trains_schedules: Vec<TrainSchedule> =
        TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;

    let project_path_result = compute_projected_train_paths(
        conn,
        core_client,
        valkey_client,
        path,
        infra_id,
        trains_schedules,
        electrical_profile_set_id,
    )
    .await?;

    Ok(Json(project_path_result))
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use chrono::DateTime;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_simple_train_schedule;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_train_schedule_base;
    use crate::models::fixtures::PartialProjectPathTrainResult;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::tests::mocked_core_pathfinding_sim_and_proj;

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
    async fn train_schedule_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule_base = simple_train_schedule_base();

        // Insert train_schedule
        let request = app
            .post(format!("/timetable/{}/train_schedules", timetable.id).as_str())
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
        let core = mocked_core_pathfinding_sim_and_proj(train_schedule.id);
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
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

    #[rstest]
    async fn train_schedule_project_path() {
        // SETUP
        let db_pool = DbConnectionPoolV2::for_tests();

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
            train_schedule: train_schedule_base.clone(),
        }
        .into();
        let train_schedule_valid = train_schedule
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        let train_schedule_fail: Changeset<TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: TrainScheduleBase {
                rolling_stock_name: "fail".to_string(),
                start_time: DateTime::from_timestamp(0, 0).unwrap(),
                ..train_schedule_base.clone()
            },
        }
        .into();

        let train_schedule_fail = train_schedule_fail
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        let core = mocked_core_pathfinding_sim_and_proj(train_schedule_valid.id);
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();

        // TEST
        let request = app.post("/train_schedule/project_path").json(&json!({
            "infra_id": small_infra.id,
            "electrical_profile_set_id": null,
            "ids": vec![train_schedule_fail.id, train_schedule_valid.id],
            "path": {
                "track_section_ranges": [
                    {"track_section": "TA1", "begin": 0, "end": 100, "direction": "START_TO_STOP"}
                ],
                "routes": [],
                "blocks": []
            }
        }));
        let response: HashMap<i64, PartialProjectPathTrainResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // EXPECT
        assert_eq!(response.len(), 1);
        assert_eq!(
            response[&train_schedule_valid.id].departure_time,
            train_schedule_base.start_time
        );
    }
}
