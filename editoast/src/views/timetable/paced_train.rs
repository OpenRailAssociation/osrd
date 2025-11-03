use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use core_client::AsCoreRequest;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::signal_projection::SignalUpdate;
use core_client::simulation::PhysicsConsist;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use itertools::Itertools;
use schemas::paced_train::PacedTrain;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AppState;
use super::AuthenticationExt;
use crate::error::Result;
use crate::models;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::paced_train::OccurrenceId;
use crate::models::paced_train::PacedTrainChangeset;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdQueryParam;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding::pathfinding_from_train;
use crate::views::projection::OperationalPointProjection;
use crate::views::projection::ProjectPathForm;
use crate::views::projection::ProjectPathOperationalPointForm;
use crate::views::projection::SpaceTimeCurve;
use crate::views::projection::compute_projected_train_path_op;
use crate::views::projection::compute_projected_train_paths;
use crate::views::timetable::PhysicsConsistParameters;
use crate::views::timetable::occupancy_blocks::OccupancyBlockForm;
use crate::views::timetable::occupancy_blocks::OccupancyBlocks;
use crate::views::timetable::occupancy_blocks::compute_occupancy_blocks;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::SummaryResponse;
use crate::views::timetable::simulation::build_path_items_to_position;
use crate::views::timetable::simulation::build_sim_power_restriction_items;
use crate::views::timetable::simulation::build_sim_schedule_items;
use crate::views::timetable::simulation::train_simulation_batch;
use crate::views::timetable::track_occupancy;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "paced_train")]
enum PacedTrainError {
    #[error("{count} paced train(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchNotFound { count: usize },
    #[error("Paced train '{paced_train_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { paced_train_id: i64 },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error("Exception '{exception_key}', could not be found")]
    #[editoast_error(status = 404)]
    ExceptionNotFound { exception_key: String },
    #[error("Operational point '{operational_point_id}', could not be found")]
    #[editoast_error(status = 404)]
    OperationalPointNotFound { operational_point_id: String },
    #[error("Rolling stock '{rolling_stock_name}', could not be found")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_name: String },
    #[error("Pathfinding failed for paced train '{paced_train_id}'")]
    #[editoast_error(status = 404)]
    PathfindingFailed { paced_train_id: i64 },
    #[error("Simulation failed for train schedule '{paced_train_id}'")]
    #[editoast_error(status = 404)]
    SimulationFailed { paced_train_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct PacedTrainResponse {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    paced_train: PacedTrain,
}

impl From<models::PacedTrain> for PacedTrainResponse {
    fn from(value: models::PacedTrain) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            paced_train: value.into(),
        }
    }
}

#[derive(Debug, IntoParams, Deserialize)]
pub(in crate::views) struct PacedTrainIdParam {
    id: i64,
}

/// Get a paced train by its ID
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["timetable", "paced_train"],
    params(PacedTrainIdParam),
    responses(
        (status = 200, body = PacedTrainResponse, description = "The requested paced train")
    )
)]
pub(in crate::views) async fn get_by_id(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let paced_train = models::PacedTrain::retrieve_or_fail(conn.clone(), paced_train_id, || {
        PacedTrainError::NotFound { paced_train_id }
    })
    .await?;

    let paced_train: PacedTrainResponse = paced_train.into();

    Ok(Json(paced_train))
}

/// Update a paced train
#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tags = ["timetable", "paced_train"],
    params(PacedTrainIdParam),
    request_body = inline(PacedTrain),
    responses(
        (status = 204, description = "The paced train has been updated")
    )
)]
pub(in crate::views) async fn update_paced_train(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
    Json(paced_train_base): Json<PacedTrain>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let paced_train_changeset: PacedTrainChangeset = paced_train_base.into();
    paced_train_changeset
        .update_or_fail(conn, paced_train_id, || PacedTrainError::NotFound {
            paced_train_id,
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct PacedTrainIds {
    ids: HashSet<i64>,
}

/// Delete a paced train
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tags = ["timetable", "paced_train"],
    request_body = inline(PacedTrainIds),
    responses(
        (status = 204, description = "All paced_trains have been deleted")
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(PacedTrainIds {
        ids: paced_train_ids,
    }): Json<PacedTrainIds>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    models::PacedTrain::delete_batch_or_fail(conn, paced_train_ids, |count| {
        PacedTrainError::BatchNotFound { count }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub(in crate::views) struct SimulationBatchForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    ids: HashSet<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq, serde::Deserialize))]
#[schema(as = PacedTrainSimulationSummaryResult)]
pub(in crate::views) struct PacedTrainSummaryResponse {
    pub paced_train: SummaryResponse,
    /// The key is the `exception_key`
    pub exceptions: HashMap<String, SummaryResponse>,
}

#[derive(Debug, Clone)]
struct SimulationContext {
    paced_train_id: i64,
    exception_key: Option<String>,
    train_schedule: schemas::TrainSchedule,
}

/// Associate each paced train id with its simulation summaries response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "paced_train",
    request_body = inline(SimulationBatchForm),
    responses(
        (status = 200, description = "Associate each paced train id with its simulation summaries", body = HashMap<i64, PacedTrainSummaryResponse>),
    ),
)]
pub(in crate::views) async fn simulation_summary(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(SimulationBatchForm {
        infra_id,
        electrical_profile_set_id,
        ids: paced_train_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, PacedTrainSummaryResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let paced_trains: Vec<models::PacedTrain> =
        models::PacedTrain::retrieve_batch_or_fail(conn, paced_train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let simulation_contexts: Vec<SimulationContext> =
        paced_trains
            .iter()
            .flat_map(|paced_train| {
                std::iter::once(SimulationContext {
                    paced_train_id: paced_train.id,
                    exception_key: None,
                    train_schedule: paced_train.clone().into_train_schedule(),
                })
                .chain(paced_train.exceptions.iter().map(|exception| {
                    SimulationContext {
                        paced_train_id: paced_train.id,
                        exception_key: Some(exception.key.clone()),
                        train_schedule: paced_train.apply_exception(exception),
                    }
                }))
            })
            .collect();

    let schedules: Vec<schemas::TrainSchedule> = simulation_contexts
        .iter()
        .map(|ctx| ctx.train_schedule.clone())
        .collect();

    let simulations = train_simulation_batch(
        conn,
        valkey_client,
        core_client,
        &schedules,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    // Will remember all simulation that already have been inserted in the response
    let mut base_simulation = Arc::clone(&simulations[0].0);
    let results = simulation_contexts.into_iter().zip(simulations).fold(
        HashMap::<i64, PacedTrainSummaryResponse>::new(),
        |mut map, (simulation_context, (simulation, path))| {
            if let Some(exception_key) = &simulation_context.exception_key {
                if !Arc::ptr_eq(&base_simulation, &simulation) {
                    map.entry(simulation_context.paced_train_id)
                        .and_modify(|summary| {
                            summary.exceptions.insert(
                                exception_key.to_string(),
                                SummaryResponse::summarize_simulation(
                                    Arc::unwrap_or_clone(simulation),
                                    Arc::unwrap_or_clone(path),
                                ),
                            );
                        });
                }
            } else {
                base_simulation = Arc::clone(&simulation);
                map.insert(
                    simulation_context.paced_train_id,
                    PacedTrainSummaryResponse {
                        paced_train: SummaryResponse::summarize_simulation(
                            Arc::unwrap_or_clone(simulation),
                            Arc::unwrap_or_clone(path),
                        ),
                        exceptions: HashMap::new(),
                    },
                );
            }
            map
        },
    );

    Ok(Json(results))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ExceptionQueryParam {
    exception_key: Option<String>,
}

/// Get a path from a paced train given an infrastructure id and a paced train id
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["paced_train", "pathfinding"],
    params(PacedTrainIdParam, InfraIdQueryParam, ExceptionQueryParam),
    responses(
        (status = 200, description = "The path", body = PathfindingResult),
        (status = 404, description = "Infrastructure or Train schedule not found")
    )
)]
pub(in crate::views) async fn get_path(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ExceptionQueryParam { exception_key }): Query<ExceptionQueryParam>,
) -> Result<Json<PathfindingResult>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = db_pool.get().await?;
    let mut valkey_conn = valkey_client.get_connection().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let paced_train = models::PacedTrain::retrieve_or_fail(conn.clone(), paced_train_id, || {
        PacedTrainError::NotFound { paced_train_id }
    })
    .await?;

    let train_schedule = match exception_key {
        Some(exception_key) => {
            let exception = paced_train
                .exceptions
                .iter()
                .find(|e| e.key == exception_key)
                .ok_or_else(|| PacedTrainError::ExceptionNotFound {
                    exception_key: exception_key.clone(),
                })?;

            paced_train.apply_exception(exception)
        }
        None => paced_train.into_train_schedule(),
    };

    Ok(Json(
        pathfinding_from_train(
            conn,
            &mut valkey_conn,
            core_client,
            &infra,
            train_schedule,
            config.app_version.as_deref(),
        )
        .await?,
    ))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct ElectricalProfileSetIdQueryParam {
    electrical_profile_set_id: Option<i64>,
}

/// Retrieve the space, speed and time curve of a given train
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "paced_train",
    params(PacedTrainIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam, ExceptionQueryParam),
    responses(
        (status = 200, description = "Simulation Output", body = simulation::Response),
    ),
)]
pub(in crate::views) async fn simulation(
    State(AppState {
        config,
        valkey_client,
        core_client,
        db_pool,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
    Query(ExceptionQueryParam { exception_key }): Query<ExceptionQueryParam>,
) -> Result<Json<simulation::Response>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Retrieve paced_train or fail
    let paced_train =
        models::PacedTrain::retrieve_or_fail(db_pool.get().await?, paced_train_id, || {
            PacedTrainError::NotFound { paced_train_id }
        })
        .await?;

    let train_schedule = match exception_key {
        Some(exception_key) => {
            let exception = paced_train
                .exceptions
                .iter()
                .find(|e| e.key == exception_key)
                .ok_or_else(|| PacedTrainError::ExceptionNotFound {
                    exception_key: exception_key.clone(),
                })?;

            paced_train.apply_exception(exception)
        }
        None => paced_train.into_train_schedule(),
    };

    // Compute simulation of a paced_train
    let (simulation, _) = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client,
        core_client,
        &[train_schedule],
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .pop()
    .unwrap();

    Ok(Json(Arc::unwrap_or_clone(simulation)))
}

/// Retrieve the etcs braking curves of an etcs train on etcs portions of the path
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["paced_train", "etcs_braking_curves"],
    params(PacedTrainIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam, ExceptionQueryParam),
    responses(
        (status = 200, description = "ETCS Braking Curves Output", body = core_client::etcs_braking_curves::Response),
    ),
)]
pub(in crate::views) async fn etcs_braking_curves(
    State(AppState {
        config,
        valkey_client,
        core_client,
        db_pool,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
    Query(ExceptionQueryParam { exception_key }): Query<ExceptionQueryParam>,
) -> Result<Json<core_client::etcs_braking_curves::Response>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Retrieve paced_train or fail
    let paced_train =
        models::PacedTrain::retrieve_or_fail(db_pool.get().await?, paced_train_id, || {
            PacedTrainError::NotFound { paced_train_id }
        })
        .await?;

    let train_schedule = match exception_key {
        Some(exception_key) => {
            let exception = paced_train
                .exceptions
                .iter()
                .find(|e| e.key == exception_key)
                .ok_or_else(|| PacedTrainError::ExceptionNotFound {
                    exception_key: exception_key.clone(),
                })?;

            paced_train.apply_exception(exception)
        }
        None => paced_train.into_train_schedule(),
    };

    // Compute simulation of a train schedule
    let (simulation_result, pathfinding_result) = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client,
        core_client.clone(),
        std::slice::from_ref(&train_schedule),
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .pop()
    .unwrap();

    // Extract simulation path
    let pathfinding_response: PathfindingResultSuccess = match pathfinding_result.as_ref() {
        PathfindingResult::Success(path) => path.clone(),
        _ => {
            return Err(PacedTrainError::PathfindingFailed { paced_train_id }.into());
        }
    };

    // Extract mrsp
    let mrsp = match simulation_result.as_ref() {
        simulation::Response::Success(SimulationResponseSuccess { mrsp, .. }) => mrsp.clone(),
        _ => {
            return Err(PacedTrainError::SimulationFailed { paced_train_id }.into());
        }
    };

    // Build physics consist
    let rs = RollingStock::retrieve_or_fail(
        db_pool.get().await?,
        train_schedule.rolling_stock_name.clone(),
        || PacedTrainError::RollingStockNotFound {
            rolling_stock_name: train_schedule.rolling_stock_name.clone(),
        },
    )
    .await?;
    let physics_consist: PhysicsConsist =
        PhysicsConsistParameters::from_traction_engine(rs.into()).into();

    // Build schedule items and power restrictions
    let path_items_to_position = build_path_items_to_position(
        &train_schedule.path,
        &pathfinding_response.path_item_positions,
    );
    let schedule = build_sim_schedule_items(&train_schedule.schedule, &path_items_to_position);
    let power_restrictions = build_sim_power_restriction_items(
        &train_schedule.power_restrictions,
        &path_items_to_position,
    );

    let etcs_braking_curves_request = core_client::etcs_braking_curves::Request {
        infra: infra.id,
        expected_version: infra.version,
        physics_consist,
        comfort: train_schedule.comfort,
        path: pathfinding_response.path,
        schedule,
        power_restrictions,
        electrical_profile_set_id,
        use_electrical_profiles: train_schedule.options.use_electrical_profiles,
        mrsp,
    };

    let etcs_braking_curves_response = etcs_braking_curves_request
        .fetch(core_client.as_ref())
        .await?;

    Ok(Json(etcs_braking_curves_response))
}

/// Project path output is described by time-space points and blocks
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ProjectPathPacedTrainResult {
    /// Paced train
    pub paced_train: Vec<SpaceTimeCurve>,
    /// Exceptions whose projection is different from the paced train
    pub exceptions: HashMap<String, Vec<SpaceTimeCurve>>,
}

/// Projects the space-time curves and paths of a number of paced trains onto a given path.
///
/// - Returns 404 if the infra or any of the paced trains are not found
/// - Returns 200 with a hashmap of train_id to ProjectPathTrainResult
///
/// ## Important:
/// - **Only one train schedule per paced train is projected**.
/// - The train schedule selected is the first occurrence of the paced train.
/// - Paced trains that are **invalid** (e.g., due to pathfinding or simulation failure) are **excluded** from the result.
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "paced_train",
    request_body = ProjectPathForm,
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<i64, ProjectPathPacedTrainResult>)),
)]
pub(in crate::views) async fn project_path(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(ProjectPathForm {
        infra_id,
        ids: paced_train_ids,
        track_section_ranges,
        electrical_profile_set_id,
    }): Json<ProjectPathForm>,
) -> Result<Json<HashMap<i64, ProjectPathPacedTrainResult>>> {
    let infra = &Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let paced_trains: Vec<models::PacedTrain> =
        models::PacedTrain::retrieve_batch_or_fail(conn, paced_train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let simulation_contexts: Vec<SimulationContext> =
        paced_trains
            .iter()
            .flat_map(|paced_train| {
                std::iter::once(SimulationContext {
                    paced_train_id: paced_train.id,
                    exception_key: None,
                    train_schedule: paced_train.clone().into_train_schedule(),
                })
                .chain(paced_train.exceptions.iter().map(|exception| {
                    SimulationContext {
                        paced_train_id: paced_train.id,
                        exception_key: Some(exception.key.clone()),
                        train_schedule: paced_train.apply_exception(exception),
                    }
                }))
            })
            .collect();

    let project_path_result = compute_projected_train_paths(
        conn,
        core_client,
        valkey_client,
        track_section_ranges,
        infra,
        &simulation_contexts
            .iter()
            .map(|c| c.train_schedule.clone())
            .collect::<Vec<_>>(),
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .into_iter()
    .collect::<Vec<_>>();

    let mut base_project_path = Default::default();

    let results = simulation_contexts.into_iter().enumerate().fold(
        HashMap::<i64, ProjectPathPacedTrainResult>::new(),
        |mut results, (index, simulation_context)| {
            if let Some(exception_key) = simulation_context.exception_key {
                if !Arc::ptr_eq(&base_project_path, &project_path_result[index]) {
                    results
                        .get_mut(&simulation_context.paced_train_id)
                        .expect("paced_train_id should exist")
                        .exceptions
                        .insert(
                            exception_key,
                            Arc::unwrap_or_clone(project_path_result[index].clone()),
                        );
                }
            } else {
                results.insert(
                    simulation_context.paced_train_id,
                    ProjectPathPacedTrainResult {
                        paced_train: Arc::unwrap_or_clone(project_path_result[index].clone()),
                        exceptions: HashMap::new(),
                    },
                );
                base_project_path = project_path_result[index].clone();
            };
            results
        },
    );

    Ok(Json(results))
}

/// Represents either a paced train or an exception of a paced train
enum BaseOrExceptionId {
    Exception {
        paced_train_id: i64,
        exception_key: String,
    },
    PacedTrain {
        paced_train_id: i64,
    },
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(ProjectPathOperationalPointForm),
    responses(
        (status = 200, description = "Project paced trains on a list of operational points.", body = HashMap<i64,ProjectPathPacedTrainResult>),
    ),
)]
pub(in crate::views) async fn project_path_op(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(ProjectPathOperationalPointForm {
        infra_id,
        train_ids,
        electrical_profile_set_id,
        operational_points_refs,
        operational_points_distances,
    }): Json<ProjectPathOperationalPointForm>,
) -> Result<Json<HashMap<i64, ProjectPathPacedTrainResult>>> {
    let infra = &Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let paced_trains: Vec<models::PacedTrain> =
        models::PacedTrain::retrieve_batch_or_fail(conn, train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let (ids, train_schedules): (Vec<_>, Vec<_>) = paced_trains
        .iter()
        .flat_map(|paced_train| {
            std::iter::once((
                BaseOrExceptionId::PacedTrain {
                    paced_train_id: paced_train.id,
                },
                paced_train.clone().into_train_schedule(),
            ))
            .chain(paced_train.exceptions.iter().map(|exception| {
                (
                    BaseOrExceptionId::Exception {
                        paced_train_id: paced_train.id,
                        exception_key: exception.key.clone(),
                    },
                    paced_train.apply_exception(exception),
                )
            }))
        })
        .collect();

    // Transform operational point references into a list of path item locations
    let path_item_locations_projection = operational_points_refs
        .iter()
        .map(|op_ref| {
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: op_ref.clone(),
                track_reference: None,
            })
        })
        .collect::<Vec<_>>();

    let path_item_locations: Vec<&PathItemLocation> = train_schedules
        .iter()
        .flat_map(|ts| ts.path.iter().map(|p| &p.location))
        .chain(&path_item_locations_projection)
        .collect();

    let path_item_cache = PathItemCache::load(conn, infra.id, &path_item_locations).await?;

    let operational_points_projection = OperationalPointProjection::new(
        operational_points_refs,
        operational_points_distances,
        &path_item_cache,
    )?;

    let projected_trains = compute_projected_train_path_op(
        conn,
        valkey_client,
        core_client,
        &train_schedules,
        &path_item_cache,
        operational_points_projection,
        infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    let mut base_project_path = Default::default();

    let results = ids.into_iter().zip(projected_trains).fold(
        HashMap::<i64, ProjectPathPacedTrainResult>::new(),
        |mut results, (id, projected_train)| {
            match id {
                BaseOrExceptionId::Exception {
                    paced_train_id,
                    exception_key,
                } => {
                    if !Arc::ptr_eq(&base_project_path, &projected_train) {
                        results
                            .get_mut(&paced_train_id)
                            .expect("paced_train_id should exist")
                            .exceptions
                            .insert(exception_key, Arc::unwrap_or_clone(projected_train.clone()));
                    }
                }
                BaseOrExceptionId::PacedTrain { paced_train_id } => {
                    results.insert(
                        paced_train_id,
                        ProjectPathPacedTrainResult {
                            paced_train: Arc::unwrap_or_clone(projected_train.clone()),
                            exceptions: HashMap::new(),
                        },
                    );
                    base_project_path = projected_train;
                }
            };
            results
        },
    );

    Ok(Json(results))
}

/// Occupancy blocks output is described by blocks (signal updates)
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct OccupancyBlocksPacedTrainResult {
    /// Paced train
    #[schema(value_type = Vec<SignalUpdate>)]
    pub paced_train: OccupancyBlocks,
    /// Exceptions whose blocks are different from the paced train
    #[schema(value_type = HashMap<String, Vec<SignalUpdate>>)]
    pub exceptions: HashMap<String, OccupancyBlocks>,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "paced_train",
    request_body = OccupancyBlockForm,
    responses(
        (status = 200, body = HashMap<i64, OccupancyBlocksPacedTrainResult>),
    ),
)]
pub(in crate::views) async fn occupancy_blocks(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(OccupancyBlockForm {
        infra_id,
        ids: paced_train_ids,
        path,
        electrical_profile_set_id,
    }): Json<OccupancyBlockForm>,
) -> Result<Json<HashMap<i64, OccupancyBlocksPacedTrainResult>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let infra = &Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let paced_trains: Vec<_> =
        models::PacedTrain::retrieve_batch_or_fail(conn, paced_train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let simulation_contexts: Vec<SimulationContext> =
        paced_trains
            .iter()
            .flat_map(|paced_train| {
                std::iter::once(SimulationContext {
                    paced_train_id: paced_train.id,
                    exception_key: None,
                    train_schedule: paced_train.clone().into_train_schedule(),
                })
                .chain(paced_train.exceptions.iter().map(|exception| {
                    SimulationContext {
                        paced_train_id: paced_train.id,
                        exception_key: Some(exception.key.clone()),
                        train_schedule: paced_train.apply_exception(exception),
                    }
                }))
            })
            .collect();

    let train_schedules = simulation_contexts
        .iter()
        .map(|c| c.train_schedule.clone())
        .collect::<Vec<_>>();

    let occupancy_blocks_result = compute_occupancy_blocks(
        conn,
        core_client,
        valkey_client,
        path,
        infra,
        &train_schedules,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    let mut base_occupancy_blocks = occupancy_blocks_result[0].clone();
    let mut results = HashMap::<i64, OccupancyBlocksPacedTrainResult>::new();

    for (index, simulation_context) in simulation_contexts.into_iter().enumerate() {
        if let Some(exception_key) = simulation_context.exception_key {
            if !Arc::ptr_eq(&base_occupancy_blocks, &occupancy_blocks_result[index]) {
                results
                    .get_mut(&simulation_context.paced_train_id)
                    .expect("paced_train_id should exist")
                    .exceptions
                    .insert(
                        exception_key,
                        Arc::unwrap_or_clone(occupancy_blocks_result[index].clone()),
                    );
            }
        } else {
            results.insert(
                simulation_context.paced_train_id,
                OccupancyBlocksPacedTrainResult {
                    paced_train: Arc::unwrap_or_clone(occupancy_blocks_result[index].clone()),
                    exceptions: HashMap::new(),
                },
            );
            base_occupancy_blocks = occupancy_blocks_result[index].clone();
        }
    }
    Ok(Json(results))
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = PacedTrainTrackOccupancyForm)]
pub(in crate::views) struct TrackOccupancyForm {
    paced_train_ids: Vec<i64>,
    operational_point_id: String,
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(as = PacedTrainTrackOccupancy)]
pub(in crate::views) struct TrackOccupancy {
    paced_train_id: i64,
    #[serde(flatten)]
    #[schema(inline)]
    occurrence_id: OccurrenceId,
    #[serde(flatten)]
    #[schema(inline)]
    time_window: track_occupancy::TimeWindow,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "paced_train",
    request_body = inline(TrackOccupancyForm),
    responses(
        (status = 200, description = "Track section occupancy periods for paced trains",
         body = inline(HashMap<String, Vec<TrackOccupancy>>)),
    ),
)]
pub(in crate::views) async fn track_occupancy(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(TrackOccupancyForm {
        paced_train_ids,
        operational_point_id,
        infra_id,
        electrical_profile_set_id,
    }): Json<TrackOccupancyForm>,
) -> Result<Json<HashMap<String, Vec<TrackOccupancy>>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Load infrastructure and paced trains
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let paced_trains: Vec<models::PacedTrain> =
        models::PacedTrain::retrieve_batch_or_fail(conn, paced_train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    // Get the operational point
    let operational_point = models::OperationalPointModel::retrieve_or_fail(
        db_pool.get().await?,
        (infra_id, operational_point_id.clone()),
        || PacedTrainError::OperationalPointNotFound {
            operational_point_id: operational_point_id.clone(),
        },
    )
    .await?;

    // Collect all occurrences from all paced trains using iter_occurrences()
    let train_occurrences = paced_trains
        .iter()
        .flat_map(|paced_train| {
            paced_train
                .iter_occurrences()
                .map(|(occurrence_id, train_schedule)| {
                    (paced_train.id, occurrence_id, train_schedule)
                })
        })
        .collect_vec();

    // Extract train schedules for simulation
    let train_schedules = train_occurrences
        .iter()
        .map(|(_, _, train_schedule)| train_schedule.clone())
        .collect_vec();

    let simulations_result = train_simulation_batch(
        conn,
        valkey_client,
        core_client,
        &train_schedules,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    // Get track positions at the operational point
    let operational_point_track_offsets = operational_point.schema.track_offset();

    let path_items = train_schedules
        .iter()
        .flat_map(|ts| &ts.path)
        .map(|p| &p.location)
        .collect_vec();

    let path_item_cache = PathItemCache::load(conn, infra_id, &path_items).await?;

    // For each occurrence + simulation result, compute track occupancies
    let all_occupancies: Vec<(String, TrackOccupancy)> = train_occurrences
        .into_iter()
        .zip(simulations_result)
        .flat_map(
            |((paced_train_id, occurrence_id, train_schedule), (simulation, pathfinding))| {
                track_occupancy::find_track_occupancy_for_operational_point(
                    &operational_point_id,
                    &operational_point_track_offsets,
                    &path_item_cache,
                    &simulation,
                    &pathfinding,
                    &train_schedule,
                )
                .into_iter()
                .map(
                    move |track_occupancy::TrackOccupancy {
                              track_section,
                              time_window,
                          }| {
                        (
                            track_section,
                            TrackOccupancy {
                                paced_train_id,
                                occurrence_id: occurrence_id.clone(),
                                time_window,
                            },
                        )
                    },
                )
                .collect_vec()
            },
        )
        .collect();

    // Group occupancies by track section
    let results: HashMap<String, Vec<TrackOccupancy>> =
        all_occupancies
            .into_iter()
            .fold(HashMap::new(), |mut map, (track_section, occupancy)| {
                map.entry(track_section).or_default().push(occupancy);
                map
            });

    Ok(Json(results))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use chrono::DateTime;
    use chrono::Duration;
    use chrono::TimeDelta;
    use core_client::mocking::MockingClient;
    use core_client::pathfinding::PathfindingInputError;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrackRange;
    use core_client::pathfinding::TrainPath;
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ElectricalProfiles;
    use core_client::simulation::ReportTrain;
    use core_client::simulation::SpeedLimitProperties;
    use database::DbConnectionPoolV2;
    use editoast_models::prelude::*;
    use editoast_models::rolling_stock::TrainMainCategory;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::fixtures::simple_created_exception_with_change_groups;
    use schemas::fixtures::simple_modified_exception_with_change_groups;
    use schemas::infra::Direction;
    use schemas::paced_train::ExceptionType;
    use schemas::paced_train::InitialSpeedChangeGroup;
    use schemas::paced_train::Paced;
    use schemas::paced_train::PacedTrain;
    use schemas::paced_train::PacedTrainException;
    use schemas::paced_train::RollingStockChangeGroup;
    use schemas::paced_train::TrainNameChangeGroup;
    use schemas::rolling_stock::TrainCategory;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::PathItem;
    use schemas::train_schedule::ScheduleItem;
    use schemas::train_schedule::TrainSchedule;
    use serde_json::json;

    use crate::error::InternalError;
    use crate::models;
    use crate::models::fixtures::create_created_exception_with_change_groups;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_paced_train_with_exceptions;
    use crate::models::fixtures::create_simple_paced_train;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::models::fixtures::simple_paced_train_changeset;
    use crate::models::fixtures::simple_sub_category;
    use crate::models::paced_train::PacedTrainChangeset;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::test_app::TestResponse;
    use crate::views::tests::mocked_core_pathfinding_sim_and_proj;
    use crate::views::timetable::paced_train::OccupancyBlocksPacedTrainResult;
    use crate::views::timetable::paced_train::PacedTrainResponse;
    use crate::views::timetable::paced_train::PacedTrainSummaryResponse;
    use crate::views::timetable::paced_train::ProjectPathPacedTrainResult;
    use crate::views::timetable::paced_train::TrackOccupancy;
    use crate::views::timetable::paced_train::TrackOccupancyForm;
    use crate::views::timetable::simulation;
    use crate::views::timetable::simulation::SimulationResponseSuccess;
    use crate::views::timetable::simulation::SummaryResponse;
    use crate::views::timetable::simulation_empty_response;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train_base = simple_paced_train_base();
        // Insert paced_train
        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&json!(vec![paced_train_base]));

        let response: Vec<PacedTrainResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_with_sub_category() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let created_sub_category = simple_sub_category(
            "tjv",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let mut paced_train_base = simple_paced_train_base();
        paced_train_base.train_schedule_base.category = Some(TrainCategory::Sub {
            sub_category_code: created_sub_category.code.clone(),
        });

        // Insert paced_train
        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&json!(vec![paced_train_base]));

        let response: Vec<PacedTrainResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.len(), 1);

        let created_paced_train =
            models::PacedTrain::retrieve(pool.get_ok(), response.first().unwrap().id)
                .await
                .expect("Failed to retrieve updated paced train")
                .expect("Updated paced train not found");

        assert_eq!(
            created_paced_train.sub_category,
            Some(created_sub_category.code.clone())
        );
        let created_paced_train: schemas::paced_train::PacedTrain = created_paced_train.into();

        assert_eq!(
            created_paced_train.train_schedule_base.category,
            Some(TrainCategory::Sub {
                sub_category_code: created_sub_category.code.clone()
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train_exception() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let simple_paced_train = simple_paced_train_changeset(timetable.id).exceptions(vec![]);
        let mut simple_paced_train = simple_paced_train
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create paced train");

        assert_eq!(simple_paced_train.exceptions.len(), 0);

        simple_paced_train.exceptions = vec![simple_created_exception_with_change_groups(
            "exception_key_1",
        )];
        let paced_train: PacedTrain = simple_paced_train.clone().into();

        let request = app
            .put(format!("/paced_train/{}", simple_paced_train.id).as_str())
            .json(&json!(&paced_train));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let created_paced_train =
            models::PacedTrain::retrieve(pool.get_ok(), simple_paced_train.id)
                .await
                .expect("Failed to retrieve updated paced train")
                .expect("Updated paced train not found");

        assert_eq!(created_paced_train.exceptions.len(), 1);
        assert_eq!(
            simple_paced_train.exceptions,
            created_paced_train.exceptions
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let mut paced_train_base = simple_paced_train_base();
        paced_train_base.paced.time_window = Duration::minutes(90).try_into().unwrap();
        paced_train_base.paced.interval = Duration::minutes(15).try_into().unwrap();

        let request = app
            .put(format!("/paced_train/{}", paced_train.id).as_str())
            .json(&json!(&paced_train_base));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let updated_paced_train = models::PacedTrain::retrieve(pool.get_ok(), paced_train.id)
            .await
            .expect("Failed to retrieve updated paced train")
            .expect("Updated paced train not found");

        assert_eq!(paced_train_base, updated_paced_train.into());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train_with_duplicated_exceptions() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let mut paced_train_base = simple_paced_train_base();
        paced_train_base.paced.time_window = Duration::minutes(90).try_into().unwrap();
        paced_train_base.paced.interval = Duration::minutes(15).try_into().unwrap();
        paced_train_base.exceptions = vec![
            simple_created_exception_with_change_groups("duplicated_key_1"),
            simple_modified_exception_with_change_groups("duplicated_key_1", 0),
        ];

        let request = app
            .put(format!("/paced_train/{}", paced_train.id).as_str())
            .json(&json!(&paced_train_base));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY)
            .bytes();
        assert_eq!(
            &String::from_utf8(response).unwrap(),
            "Failed to deserialize the JSON body into the target type: Duplicate exception key: 'duplicated_key_1'"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train_with_invalid_exceptions_occurrence_index() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let mut paced_train_base = simple_paced_train_base();
        paced_train_base.paced.time_window = Duration::minutes(60).try_into().unwrap();
        paced_train_base.paced.interval = Duration::minutes(15).try_into().unwrap();
        paced_train_base.exceptions =
            vec![simple_modified_exception_with_change_groups("key_1", 5)];

        let request = app
            .put(format!("/paced_train/{}", paced_train.id).as_str())
            .json(&json!(&paced_train_base));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY)
            .bytes();

        assert_eq!(
            &String::from_utf8(response).unwrap(),
            "Failed to deserialize the JSON body into the target type: Modified exception 'key_1' references invalid occurrence index 5"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let request = app
            .delete("/paced_train/")
            .json(&json!({"ids": vec![paced_train.id]}));

        let _ = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = models::PacedTrain::exists(&mut pool.get_ok(), paced_train.id)
            .await
            .expect("Failed to retrieve paced_train");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_not_found_paced_train() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/paced_train/{}", 0));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:NotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let request = app.get(&format!("/paced_train/{}", paced_train.id));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<PacedTrainResponse>();

        assert_eq!(response.paced_train, paced_train.into());
    }

    async fn app_infra_id_paced_train_id_for_simulation_tests() -> (TestApp, i64, i64) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let paced_train_base = PacedTrain {
            train_schedule_base: TrainSchedule {
                rolling_stock_name: rolling_stock.name.clone(),
                ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                    .expect("Unable to parse")
            },
            exceptions: vec![create_created_exception_with_change_groups(
                "created_exception_key",
            )],
            paced: Paced {
                time_window: Duration::hours(1).try_into().unwrap(),
                interval: Duration::minutes(15).try_into().unwrap(),
            },
        };
        let paced_train: PacedTrainChangeset = paced_train_base.into();
        let paced_train = paced_train
            .timetable_id(timetable.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");
        let core = mocked_core_pathfinding_sim_and_proj();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();
        (app, small_infra.id, paced_train.id)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!("/paced_train/{train_schedule_id}/simulation/?infra_id={infra_id}").as_str(),
        );
        let response: core_client::simulation::Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response, simulation_empty_response());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_exception_simulation_with_invalid_exception_key() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!(
                "/paced_train/{train_schedule_id}/simulation/?infra_id={infra_id}&exception_key=toto"
            )
            .as_str(),
        );
        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:paced_train:ExceptionNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_exception_simulation() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!("/paced_train/{train_schedule_id}/simulation/?infra_id={infra_id}&exception_key=created_exception_key").as_str(),
        );
        let response: simulation::Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(
            response,
            simulation::Response::Success(SimulationResponseSuccess {
                base: ReportTrain {
                    positions: vec![],
                    times: vec![0],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 1]
                },
                provisional: ReportTrain {
                    positions: vec![],
                    times: vec![0],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 1]
                },
                final_output: CompleteReportTrain {
                    report_train: ReportTrain {
                        positions: vec![0],
                        times: vec![0],
                        speeds: vec![],
                        energy_consumption: 0.0,
                        path_item_times: vec![0, 1]
                    },
                    signal_critical_positions: vec![],
                    zone_updates: vec![],
                    spacing_requirements: vec![],
                    routing_requirements: vec![]
                },
                mrsp: SpeedLimitProperties {
                    boundaries: vec![],
                    values: vec![]
                },
                electrical_profiles: ElectricalProfiles {
                    boundaries: vec![],
                    values: vec![]
                }
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_exception_simulation_with_rolling_stock_not_found() {
        // GIVEN
        let (app, infra_id, train_schedule_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(format!("/paced_train/{train_schedule_id}").as_str());
        let mut paced_train_response: PacedTrainResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        paced_train_response.paced_train.exceptions[0].rolling_stock =
            Some(RollingStockChangeGroup {
                rolling_stock_name: "R2D2".into(),
                comfort: Comfort::AirConditioning,
            });
        let request = app
            .put(format!("/paced_train/{train_schedule_id}").as_str())
            .json(&json!(paced_train_response.paced_train));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);
        // WHEN
        let request = app.get(
            format!("/paced_train/{train_schedule_id}/simulation/?infra_id={infra_id}&exception_key=created_exception_key").as_str(),
        );
        let response: simulation::Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        // THEN
        assert_eq!(
            response,
            simulation::Response::PathfindingFailed {
                pathfinding_failed: PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::RollingStockNotFound {
                        rolling_stock_name: "R2D2".into()
                    }
                )
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_not_found() {
        let (app, infra_id, _paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request =
            app.get(format!("/paced_train/{}/simulation/?infra_id={}", 0, infra_id).as_str());

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:NotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary() {
        let (app, infra_id, paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(format!("/paced_train/{paced_train_id}").as_str());
        let mut paced_train_response: PacedTrainResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        // First remove all already generated exceptions
        paced_train_response.paced_train.exceptions.clear();
        // Add one exception which will not change the simulation from base
        paced_train_response
            .paced_train
            .exceptions
            .push(PacedTrainException {
                key: "change_train_name".to_string(),
                train_name: Some(TrainNameChangeGroup {
                    value: "exception_name_but_same_simulation".into(),
                }),
                ..Default::default()
            });
        // Add one exception which will change the simulation from base
        // and therefore add another entry in the response (field `exceptions`)
        paced_train_response
            .paced_train
            .exceptions
            .push(PacedTrainException {
                key: "change_initial_speed".to_string(),
                initial_speed: Some(InitialSpeedChangeGroup { value: 1.23 }),
                ..Default::default()
            });
        let request = app
            .put(format!("/paced_train/{paced_train_id}").as_str())
            .json(&json!(paced_train_response.paced_train));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);
        let request = app.post("/paced_train/simulation_summary").json(&json!({
            "infra_id": infra_id,
            "ids": vec![paced_train_id],
        }));

        let response: HashMap<i64, PacedTrainSummaryResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(
            *response.get(&paced_train_id).unwrap(),
            PacedTrainSummaryResponse {
                paced_train: SummaryResponse::Success {
                    length: 0,
                    time: 1,
                    energy_consumption: 0.0,
                    path_item_times_final: vec![0, 1],
                    path_item_times_provisional: vec![0, 1],
                    path_item_times_base: vec![0, 1],
                    path_item_positions: vec![0, 1, 2, 3]
                },
                exceptions: [(
                    "change_initial_speed".to_string(),
                    // Simulation of the exception is the same than base
                    // because all simulation results from core are identical stubs
                    SummaryResponse::Success {
                        length: 0,
                        time: 1,
                        energy_consumption: 0.0,
                        path_item_times_final: vec![0, 1],
                        path_item_times_provisional: vec![0, 1],
                        path_item_times_base: vec![0, 1],
                        path_item_positions: vec![0, 1, 2, 3]
                    }
                )]
                .into_iter()
                .collect()
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary_not_found() {
        let (app, infra_id, _paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.post("/paced_train/simulation_summary").json(&json!({
            "infra_id": infra_id,
            "ids": vec![0],
        }));
        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:BatchNotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_infra_not_found() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let request = app.get(&format!(
            "/paced_train/{}/path?infra_id={}",
            paced_train.id, 0
        ));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:InfraNotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_not_found() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let small_infra = create_small_infra(&mut pool.get_ok()).await;

        let request = app.get(&format!(
            "/paced_train/{}/path?infra_id={}",
            0, small_infra.id
        ));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:NotFound");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_with_invalid_exception_key() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let small_infra = create_small_infra(&mut pool.get_ok()).await;
        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;
        let request = app.get(
            format!(
                "/paced_train/{}/path/?infra_id={}&exception_key=toto",
                paced_train.id, small_infra.id
            )
            .as_str(),
        );
        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:paced_train:ExceptionNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "path": {
                    "blocks":[],
                    "routes": [],
                    "track_section_ranges": [],
                },
                "path_item_positions": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut db_pool.get_ok(), timetable.id).await;
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/paced_train/{}/path?infra_id={}",
            paced_train.id, small_infra.id
        ));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<PathfindingResult>();

        assert_eq!(
            response,
            PathfindingResult::Success(PathfindingResultSuccess {
                path: TrainPath {
                    blocks: vec![],
                    routes: vec![],
                    track_section_ranges: vec![],
                },
                path_item_positions: vec![],
                length: 1
            })
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_exception_path_rolling_stock_not_found() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "blocks":[],
                "routes": [],
                "track_section_ranges": [],
                "path_item_positions": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let mut exception = create_created_exception_with_change_groups("exception_created_key");
        exception.rolling_stock = Some(RollingStockChangeGroup {
            rolling_stock_name: "exception_rolling_stock".into(),
            comfort: Comfort::Standard,
        });
        let paced_train = create_paced_train_with_exceptions(
            &mut db_pool.get_ok(),
            timetable.id,
            vec![exception.clone()],
        )
        .await;

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/paced_train/{}/path?infra_id={}&exception_key={}",
            paced_train.id, small_infra.id, exception.key
        ));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<PathfindingResult>();

        assert_eq!(
            response,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::RollingStockNotFound {
                    rolling_stock_name: "exception_rolling_stock".into()
                }
            ))
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_exception_path() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "path": {
                    "blocks":[],
                    "routes": [],
                    "track_section_ranges": [],
                },
                "path_item_positions": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let exception = create_created_exception_with_change_groups("exception_created_key");
        let paced_train = create_paced_train_with_exceptions(
            &mut db_pool.get_ok(),
            timetable.id,
            vec![exception.clone()],
        )
        .await;

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/paced_train/{}/path?infra_id={}&exception_key={}",
            paced_train.id, small_infra.id, exception.key
        ));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<PathfindingResult>();

        assert_eq!(
            response,
            PathfindingResult::Success(PathfindingResultSuccess {
                path: TrainPath {
                    blocks: vec![],
                    routes: vec![],
                    track_section_ranges: vec![],
                },
                path_item_positions: vec![],
                length: 1
            })
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_project_path() {
        // SETUP
        let db_pool = DbConnectionPoolV2::for_tests();

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let _ = create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let paced_train_valid =
            create_simple_paced_train(&mut db_pool.get_ok(), timetable.id).await;
        let paced_train_fail = simple_paced_train_changeset(timetable.id)
            .rolling_stock_name("fail".to_string())
            .start_time(DateTime::from_timestamp(0, 0).unwrap())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let core = mocked_core_pathfinding_sim_and_proj();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();

        // TEST
        let request = app.post("/paced_train/project_path").json(&json!({
            "infra_id": small_infra.id,
            "electrical_profile_set_id": null,
            "ids": vec![paced_train_fail.id, paced_train_valid.id],
            "track_section_ranges": [
                {
                    "track_section": "TA1",
                    "begin": 0,
                    "end": 100,
                    "direction": "START_TO_STOP"
                }
            ],
        }));
        let response: HashMap<i64, ProjectPathPacedTrainResult> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        // EXPECT
        // TODO: improve this test
        assert_eq!(response.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_occupancy_blocks() {
        let (app, infra_id, paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;

        let request = app.get(format!("/paced_train/{paced_train_id}").as_str());
        let mut paced_train_response: PacedTrainResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        // First remove all already generated exceptions
        paced_train_response.paced_train.exceptions.clear();

        // Add one exception which will not change the simulation from base
        paced_train_response
            .paced_train
            .exceptions
            .push(PacedTrainException {
                key: "change_train_name".to_string(),
                train_name: Some(TrainNameChangeGroup {
                    value: "exception_name_but_same_simulation".into(),
                }),
                ..Default::default()
            });
        // Add one exception which will change the simulation from base
        // and therefore add another entry in the response (field `exceptions`)
        paced_train_response
            .paced_train
            .exceptions
            .push(PacedTrainException {
                key: "change_initial_speed".to_string(),
                initial_speed: Some(InitialSpeedChangeGroup { value: 1.23 }),
                ..Default::default()
            });
        let request = app
            .put(format!("/paced_train/{paced_train_id}").as_str())
            .json(&json!(paced_train_response.paced_train));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let request =
            app.post("/paced_train/occupancy_blocks")
                .json(&json!({"ids": vec![paced_train_id],
                    "infra_id": infra_id,
                    "path": {
                        "track_section_ranges": [{
                            "track_section": "T1",
                            "begin": 0,
                            "end": 100,
                            "direction": "START_TO_STOP",
                        }],
                        "routes": [],
                        "blocks":[],
                    },
                }));
        let response = app.fetch(request).await;
        let response: HashMap<i64, OccupancyBlocksPacedTrainResult> =
            response.assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(response.get(&paced_train_id).unwrap().paced_train.len(), 1);
        assert_eq!(response.get(&paced_train_id).unwrap().exceptions.len(), 0);
    }

    fn pathfinding_result_success() -> PathfindingResultSuccess {
        PathfindingResultSuccess {
            path: TrainPath {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![
                    TrackRange::new("TC1", 550000, 1000000, Direction::StartToStop), // Mid_West_station
                    TrackRange::new("TD0", 0, 14000000, Direction::StartToStop), // Mid_East_station
                ],
            },
            length: 14450000,
            path_item_positions: vec![0, 14450000],
        }
    }

    async fn init_paced_train_test(
        exceptions: Vec<PacedTrainException>,
        operational_point_id: String,
    ) -> TestResponse {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_empty_response())
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let paced_train = models::PacedTrain::default()
            .into_changeset()
            .timetable_id(timetable.id)
            .rolling_stock_name(rolling_stock.name)
            .path(vec![
                PathItem::new_operational_point("Mid_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
            ])
            .schedule(vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )])
            .interval(TimeDelta::minutes(15))
            .time_window(TimeDelta::hours(1))
            .exceptions(exceptions)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let request = app
            .post("/paced_train/track_occupancy")
            .json(&TrackOccupancyForm {
                paced_train_ids: vec![paced_train.id],
                operational_point_id,
                infra_id: small_infra.id,
                electrical_profile_set_id: None,
            });

        app.fetch(request).await
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(vec![], 4)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(vec![
        PacedTrainException { exception_type: ExceptionType::Created {}, ..Default::default()}], 5)
    ]
    async fn paced_train_track_occupancy(
        #[case] exceptions: Vec<PacedTrainException>,
        #[case] paced_trains: usize,
    ) {
        let response = init_paced_train_test(exceptions, "Mid_West_station".to_string());
        let track_occupancies: HashMap<String, Vec<TrackOccupancy>> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert_eq!(track_occupancies.len(), 1);
        assert_eq!(
            track_occupancies
                .get("TC1")
                .expect("Expected track occupancies for TC1 but none were found")
                .len(),
            paced_trains
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_returns_empty_track_occupancies() {
        let response = init_paced_train_test(Vec::new(), "West_station".to_string());
        let track_occupancies: HashMap<String, Vec<TrackOccupancy>> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert!(track_occupancies.is_empty());
    }
}
