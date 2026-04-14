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
use chrono::Duration;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::signal_projection::SignalUpdate;
use core_client::simulation::PhysicsConsist;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::TrainScheduleException;
use editoast_models::prelude::*;
use editoast_models::round_trips::TrainScheduleRoundTrips;
use itertools::Itertools;
use itertools::izip;
use reqwest::StatusCode;
use schemas::infra::OperationalPoint;
use schemas::paced_train::TrainSchedule;
use schemas::primitives::NonBlankString;
use schemas::primitives::TimeWindow;
use schemas::train_schedule::OperationalPointPartReference;
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
use crate::models::train_schedule::OccurrenceId;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::models::train_schedule_set::TrainScheduleSet;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdQueryParam;
use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding::pathfinding_from_train;
use crate::views::projection::OperationalPointProjection;
use crate::views::projection::ProjectPathForm;
use crate::views::projection::ProjectPathOperationalPointForm;
use crate::views::projection::SpaceTimeCurve;
use crate::views::projection::compute_projected_train_path_op;
use crate::views::projection::compute_projected_train_path_op_without_simulation;
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
use editoast_models::rolling_stock::RollingStock;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule")]
enum TrainScheduleError {
    #[error("{count} train schedule(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchNotFound { count: usize },
    #[error("Train schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_id: i64 },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error("Exception '{exception_key}', could not be found")]
    #[editoast_error(status = 404)]
    ExceptionNotFound { exception_key: String },
    #[error("Rolling stock '{rolling_stock_name}', could not be found")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_name: String },
    #[error("Pathfinding failed for train schedule '{train_schedule_id}'")]
    #[editoast_error(status = 404)]
    PathfindingFailed { train_schedule_id: i64 },
    #[error("Simulation failed for train schedule '{train_schedule_id}'")]
    #[editoast_error(status = 404)]
    SimulationFailed { train_schedule_id: i64 },
    #[error("Train schedule set '{train_schedule_set_id}', could not be found")]
    #[editoast_error(status = 404)]
    TrainScheduleSetNotFound { train_schedule_set_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleResponse {
    pub id: i64,
    pub train_schedule_set_id: i64,
    #[serde(flatten)]
    pub train_schedule: TrainSchedule,
}

impl From<models::TrainSchedule> for TrainScheduleResponse {
    fn from(value: models::TrainSchedule) -> Self {
        Self {
            id: value.id,
            train_schedule_set_id: value.train_schedule_set_id,
            train_schedule: value.into(),
        }
    }
}

#[derive(Debug, IntoParams, Deserialize)]
pub(in crate::views) struct TrainScheduleIdParam {
    id: i64,
}

/// Get a train schedule by its ID
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["timetable", "train_schedule"],
    params(TrainScheduleIdParam),
    responses(
        (status = 200, body = TrainScheduleResponse, description = "The requested train schedule")
    )
)]
pub(in crate::views) async fn get_by_id(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(conn.clone(), train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

    let train_schedule: TrainScheduleResponse = train_schedule.into();

    Ok(Json(train_schedule))
}

/// Update a paced train
#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tags = ["timetable", "train_schedule"],
    params(TrainScheduleIdParam),
    request_body = TrainSchedule,
    responses(
        (status = 204, description = "The paced train has been updated")
    )
)]
pub(in crate::views) async fn update_train_schedule(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Json(train_schedule_base): Json<TrainSchedule>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let train_schedule_changeset: TrainScheduleChangeset = train_schedule_base.into();
    train_schedule_changeset
        .update_or_fail(conn, train_schedule_id, || TrainScheduleError::NotFound {
            train_schedule_id,
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleIds {
    ids: HashSet<i64>,
}

/// Delete a train schedule
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tags = ["timetable", "train_schedule"],
    request_body = inline(TrainScheduleIds),
    responses(
        (status = 204, description = "All train schedules have been deleted")
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(TrainScheduleIds {
        ids: train_schedule_ids,
    }): Json<TrainScheduleIds>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    models::TrainSchedule::delete_batch_or_fail(conn, train_schedule_ids, |count| {
        TrainScheduleError::BatchNotFound { count }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub(in crate::views) struct SimulationBatchForm {
    infra_id: i64,
    timetable_id: i64,
    electrical_profile_set_id: Option<i64>,
    ids: HashSet<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq, serde::Deserialize))]
#[schema(as = TrainScheduleSimulationSummaryResult)]
pub(in crate::views) struct TrainScheduleSummaryResponse {
    pub train_schedule: SummaryResponse,
    /// The key is the `exception_key`
    pub exceptions: HashMap<String, SummaryResponse>,
}

#[derive(Debug, Clone)]
struct SimulationContext {
    paced_train_id: i64,
    exception_id: Option<i64>,
    train_schedule: schemas::TrainOccurrence,
}

/// Associate each train schedule id with its simulation summaries response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(SimulationBatchForm),
    responses(
        (status = 200, description = "Associate each train schedule id with its simulation summaries", body = HashMap<i64, TrainScheduleSummaryResponse>),
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
        timetable_id,
        electrical_profile_set_id,
        ids: paced_train_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, TrainScheduleSummaryResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let paced_trains: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, paced_train_ids.clone(), |missing| {
            TrainScheduleError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let mut exceptions = TrainScheduleException::retrieve_exceptions_by_train_schedules(
        conn,
        timetable_id,
        paced_train_ids.into_iter().collect(),
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.train_schedule_id);

    let simulation_contexts: Vec<SimulationContext> = paced_trains
        .iter()
        .flat_map(|paced_train| {
            let ts_exceptions = exceptions.remove(&paced_train.id).unwrap_or_default();
            std::iter::once(SimulationContext {
                paced_train_id: paced_train.id,
                exception_id: None,
                train_schedule: paced_train.clone().into_train_occurrence(),
            })
            .chain(
                ts_exceptions
                    .into_iter()
                    .map(|exception| SimulationContext {
                        paced_train_id: paced_train.id,
                        exception_id: Some(exception.id),
                        train_schedule: paced_train.apply_train_schedule_exception(&exception),
                    })
                    .collect::<Vec<_>>(),
            )
        })
        .collect();

    let schedules: Vec<schemas::TrainOccurrence> = simulation_contexts
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
        HashMap::<i64, TrainScheduleSummaryResponse>::new(),
        |mut map, (simulation_context, (simulation, _path))| {
            if let Some(exception_key) = &simulation_context.exception_id {
                if !Arc::ptr_eq(&base_simulation, &simulation) {
                    map.entry(simulation_context.paced_train_id)
                        .and_modify(|summary| {
                            summary.exceptions.insert(
                                exception_key.to_string(),
                                SummaryResponse::summarize_simulation(
                                    Arc::unwrap_or_clone(simulation),
                                    &simulation_context.train_schedule,
                                ),
                            );
                        });
                }
            } else {
                base_simulation = Arc::clone(&simulation);
                map.insert(
                    simulation_context.paced_train_id,
                    TrainScheduleSummaryResponse {
                        train_schedule: SummaryResponse::summarize_simulation(
                            Arc::unwrap_or_clone(simulation),
                            &simulation_context.train_schedule,
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
    exception_id: Option<i64>,
}

/// Get a path from a paced train given an infrastructure id and a paced train id
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["train_schedule", "pathfinding"],
    params(TrainScheduleIdParam, InfraIdQueryParam, ExceptionQueryParam),
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
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ExceptionQueryParam { exception_id }): Query<ExceptionQueryParam>,
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
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let paced_train =
        models::TrainSchedule::retrieve_or_fail(conn.clone(), train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

    let train_schedule = match exception_id {
        Some(exception_id) => {
            let exception =
                TrainScheduleException::retrieve_or_fail(conn.clone(), exception_id, || {
                    TrainScheduleError::ExceptionNotFound {
                        // TODO rename to exception_id
                        exception_key: exception_id.to_string(),
                    }
                })
                .await?;
            paced_train.apply_train_schedule_exception(&exception.into())
        }
        None => paced_train.into_train_occurrence(),
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
    tag = "train_schedule",
    params(TrainScheduleIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam, ExceptionQueryParam),
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
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
    Query(ExceptionQueryParam { exception_id }): Query<ExceptionQueryParam>,
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
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Retrieve train_schedule or fail
    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(db_pool.get().await?, train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

    let train_schedule = match exception_id {
        Some(exception_id) => {
            let exception = TrainScheduleException::retrieve_or_fail(
                db_pool.get().await?,
                exception_id,
                || {
                    TrainScheduleError::ExceptionNotFound {
                        // TODO rename to exception_id
                        exception_key: exception_id.to_string(),
                    }
                },
            )
            .await?;
            train_schedule.apply_train_schedule_exception(&exception.into())
        }
        None => train_schedule.into_train_occurrence(),
    };

    // Compute simulation of a train schedule
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

    tags = ["train_schedule", "etcs_braking_curves"],
    params(TrainScheduleIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam, ExceptionQueryParam),

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
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
    Query(ExceptionQueryParam { exception_id }): Query<ExceptionQueryParam>,
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
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Retrieve train schedule or fail
    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(db_pool.get().await?, train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

    let train_occurrence = match exception_id {
        Some(exception_id) => {
            let exception: schemas::TrainScheduleException =
                TrainScheduleException::retrieve_or_fail(
                    db_pool.get().await?,
                    exception_id,
                    || TrainScheduleError::ExceptionNotFound {
                        exception_key: exception_id.to_string(),
                    },
                )
                .await?
                .into();
            train_schedule.apply_train_schedule_exception(&exception)
        }
        None => train_schedule.into_train_occurrence(),
    };

    // Compute simulation of a train schedule
    let (simulation_result, pathfinding_result) = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client,
        core_client.clone(),
        std::slice::from_ref(&train_occurrence),
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
            return Err(TrainScheduleError::PathfindingFailed { train_schedule_id }.into());
        }
    };

    // Extract mrsp
    let mrsp = match simulation_result.as_ref() {
        simulation::Response::Success(SimulationResponseSuccess { mrsp, .. }) => mrsp.clone(),
        _ => {
            return Err(TrainScheduleError::SimulationFailed { train_schedule_id }.into());
        }
    };

    // Build physics consist
    let rs = RollingStock::retrieve_or_fail(
        db_pool.get().await?,
        train_occurrence.rolling_stock_name.clone(),
        || TrainScheduleError::RollingStockNotFound {
            rolling_stock_name: train_occurrence.rolling_stock_name.clone(),
        },
    )
    .await?;
    let physics_consist: PhysicsConsist =
        PhysicsConsistParameters::from_traction_engine(rs.into()).into();

    // Build schedule items and power restrictions
    let path_items_to_position = build_path_items_to_position(
        &train_occurrence.path,
        &pathfinding_response.path_item_positions,
    );
    let schedule = build_sim_schedule_items(&train_occurrence.schedule, &path_items_to_position);
    let power_restrictions = build_sim_power_restriction_items(
        &train_occurrence.power_restrictions,
        &path_items_to_position,
    );

    let etcs_braking_curves_request = core_client::etcs_braking_curves::Request {
        infra: infra.id,
        expected_version: infra.version,
        physics_consist,
        comfort: train_occurrence.comfort,
        path: pathfinding_response.path,
        schedule,
        power_restrictions,
        electrical_profile_set_id,
        use_electrical_profiles: train_occurrence.options.use_electrical_profiles,
        mrsp,
    };

    let etcs_braking_curves_response = etcs_braking_curves_request
        .fetch(core_client.as_ref())
        .await?;

    Ok(Json(etcs_braking_curves_response))
}

/// Project path output is described by time-space points and blocks
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ProjectPathTrainScheduleResult {
    /// Train schedule
    pub train_schedule: Vec<SpaceTimeCurve>,
    /// Exceptions whose projection is different from the train schedule when it has a paced
    pub exceptions: HashMap<String, Vec<SpaceTimeCurve>>,
}

/// Projects the space-time curves and paths of a number of train schedules onto a given path.
///
/// - Returns 404 if the infra or any of the train schedules are not found
/// - Returns 200 with a hashmap of train_id to ProjectPathTrainResult
///
/// ## Important:
/// - The main train projected is the model train schedule without exceptions.
/// - If there are exceptions defined for the train schedule that have a different projection than the main train,
///   they are included in the `exceptions` field of the result.
/// - The following train schedules are **excluded** from the result:
///     - train schedules for which pathfinding fails
///     - train schedules for which the simulation fails
/// - Trains that have a simulation but that does not honor their schedule, use their schedule with straight lines
///   between the known points.
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = ProjectPathForm,
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<i64, ProjectPathTrainScheduleResult>)),
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
        timetable_id,
        ids: train_schedule_ids,
        track_section_ranges,
        electrical_profile_set_id,
    }): Json<ProjectPathForm>,
) -> Result<Json<HashMap<i64, ProjectPathTrainScheduleResult>>> {
    let infra = &Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
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

    let train_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_schedule_ids, |missing| {
            TrainScheduleError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let train_schedule_ids = train_schedules.iter().map(|t| t.id).collect::<Vec<_>>();
    let mut exceptions = TrainScheduleException::retrieve_exceptions_by_train_schedules(
        conn,
        timetable_id,
        train_schedule_ids,
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.timetable_id);

    let simulation_contexts: Vec<SimulationContext> = train_schedules
        .iter()
        .flat_map(|train_schedule| {
            let ts_exceptions = exceptions.remove(&train_schedule.id).unwrap_or_default();
            std::iter::once(SimulationContext {
                paced_train_id: train_schedule.id,
                exception_id: None,
                train_schedule: train_schedule.clone().into_train_occurrence(),
            })
            .chain(ts_exceptions.iter().map(|exception| SimulationContext {
                paced_train_id: train_schedule.id,
                exception_id: Some(exception.id),
                train_schedule: train_schedule.apply_train_schedule_exception(exception),
            }))
            .collect::<Vec<_>>()
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
        HashMap::<i64, ProjectPathTrainScheduleResult>::new(),
        |mut results, (index, simulation_context)| {
            if let Some(exception_key) = simulation_context.exception_id {
                if !Arc::ptr_eq(&base_project_path, &project_path_result[index]) {
                    results
                        .get_mut(&simulation_context.paced_train_id)
                        .expect("paced_train_id should exist")
                        .exceptions
                        .insert(
                            exception_key.to_string(),
                            Arc::unwrap_or_clone(project_path_result[index].clone()),
                        );
                }
            } else {
                results.insert(
                    simulation_context.paced_train_id,
                    ProjectPathTrainScheduleResult {
                        train_schedule: Arc::unwrap_or_clone(project_path_result[index].clone()),
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

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(ProjectPathOperationalPointForm),
    responses(
        (status = 200, description = "Project train schedules on a list of operational points.", body = HashMap<i64,ProjectPathTrainScheduleResult>),
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
        timetable_id,
        electrical_profile_set_id,
        operational_points_refs,
        operational_points_distances,
        use_simulation,
    }): Json<ProjectPathOperationalPointForm>,
) -> Result<Json<HashMap<i64, ProjectPathTrainScheduleResult>>> {
    let infra = &Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
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

    let train_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_ids.clone(), |missing| {
            TrainScheduleError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let mut exceptions = TrainScheduleException::retrieve_exceptions_by_train_schedules(
        conn,
        timetable_id,
        train_ids.into_iter().collect(),
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.train_schedule_id);

    let (occurrences_ids, occurrences): (Vec<_>, Vec<_>) = train_schedules
        .iter()
        .flat_map(|train_schedule| {
            train_schedule
                .iter_occurrences(&exceptions.remove(&train_schedule.id).unwrap_or_default())
                .collect_vec()
        })
        .unzip();

    // Transform operational point references into a list of path item locations
    let path_item_locations_projection = operational_points_refs
        .iter()
        .map(|op_ref| {
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: op_ref.clone(),
                local_track_name: None,
            })
        })
        .collect::<Vec<_>>();

    let path_item_locations: Vec<&PathItemLocation> = train_schedules
        .iter()
        .flat_map(|ts| ts.path.iter().map(|p| &p.location))
        .chain(&path_item_locations_projection)
        .collect();

    let op_cache = OperationalPointCache::load_path_items(
        db_pool.get().await?,
        infra.id,
        &path_item_locations,
    )
    .await?;

    let operational_points_projection = OperationalPointProjection::new(
        operational_points_refs,
        operational_points_distances,
        &op_cache,
    )?;

    let projected_trains = if use_simulation {
        compute_projected_train_path_op(
            conn,
            valkey_client,
            core_client,
            &occurrences,
            &op_cache,
            operational_points_projection,
            infra,
            electrical_profile_set_id,
            config.app_version.as_deref(),
        )
        .await?
    } else {
        compute_projected_train_path_op_without_simulation(
            &occurrences,
            &op_cache,
            operational_points_projection,
        )
    };

    let mut base_project_path = Default::default();

    let results = occurrences_ids.into_iter().zip(projected_trains).fold(
        HashMap::<i64, ProjectPathTrainScheduleResult>::new(),
        |mut results, (id, projected_train)| {
            match id {
                OccurrenceId::Modified {
                    train_schedule_id,
                    exception_key,
                    ..
                }
                | OccurrenceId::Created {
                    train_schedule_id,
                    exception_key,
                    ..
                } => {
                    if !Arc::ptr_eq(&base_project_path, &projected_train) {
                        results
                            .get_mut(&train_schedule_id)
                            .expect("train_schedule_id should exist")
                            .exceptions
                            .insert(exception_key, Arc::unwrap_or_clone(projected_train.clone()));
                    }
                }
                OccurrenceId::Base {
                    train_schedule_id, ..
                } => {
                    results.insert(
                        train_schedule_id,
                        ProjectPathTrainScheduleResult {
                            train_schedule: Arc::unwrap_or_clone(projected_train.clone()),
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
pub struct OccupancyBlocksTrainScheduleResult {
    /// Train schedule
    #[schema(value_type = Vec<SignalUpdate>)]
    pub train_schedule: OccupancyBlocks,
    /// Exceptions whose blocks are different from the paced train
    #[schema(value_type = HashMap<String, Vec<SignalUpdate>>)]
    pub exceptions: HashMap<String, OccupancyBlocks>,
}

/// ## Important:
/// The following train schedules are **excluded** from the result:
/// - train schedules for which pathfinding fails
/// - train schedules for which the simulation fails
/// - train schedules for which the simulation does not respect schedule times
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = OccupancyBlockForm,
    responses(
        (status = 200, body = HashMap<i64, OccupancyBlocksTrainScheduleResult>),
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
        timetable_id,
        ids: train_schedule_ids,
        path,
        electrical_profile_set_id,
    }): Json<OccupancyBlockForm>,
) -> Result<Json<HashMap<i64, OccupancyBlocksTrainScheduleResult>>> {
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
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let train_schedules: Vec<_> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_schedule_ids, |missing| {
            TrainScheduleError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let mut exceptions =
        editoast_models::TrainScheduleException::retrieve_exceptions_by_train_schedules(
            conn,
            timetable_id,
            train_schedules.iter().map(|t| t.id).collect::<Vec<_>>(),
        )
        .await?
        .into_iter()
        .map_into::<schemas::TrainScheduleException>()
        .into_group_map_by(|e| e.train_schedule_id);

    let simulation_contexts: Vec<SimulationContext> = train_schedules
        .iter()
        .flat_map(|train_schedule| {
            let ts_exceptions = exceptions.remove(&train_schedule.id).unwrap_or_default();
            std::iter::once(SimulationContext {
                paced_train_id: train_schedule.id,
                exception_id: None,
                train_schedule: train_schedule.clone().into_train_occurrence(),
            })
            .chain(
                ts_exceptions
                    .iter()
                    .map(|exception| SimulationContext {
                        paced_train_id: train_schedule.id,
                        exception_id: Some(exception.id),
                        train_schedule: train_schedule.apply_train_schedule_exception(exception),
                    })
                    .collect::<Vec<_>>(),
            )
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
    let mut results = HashMap::<i64, OccupancyBlocksTrainScheduleResult>::new();

    for (index, simulation_context) in simulation_contexts.into_iter().enumerate() {
        if let Some(exception_key) = simulation_context.exception_id {
            if !Arc::ptr_eq(&base_occupancy_blocks, &occupancy_blocks_result[index]) {
                results
                    .get_mut(&simulation_context.paced_train_id)
                    .expect("paced_train_id should exist")
                    .exceptions
                    .insert(
                        exception_key.to_string(),
                        Arc::unwrap_or_clone(occupancy_blocks_result[index].clone()),
                    );
            }
        } else {
            results.insert(
                simulation_context.paced_train_id,
                OccupancyBlocksTrainScheduleResult {
                    train_schedule: Arc::unwrap_or_clone(occupancy_blocks_result[index].clone()),
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
    train_schedule_ids: Vec<i64>,
    operational_point_reference: OperationalPointReference,
    infra_id: i64,
    timetable_id: i64,
    electrical_profile_set_id: Option<i64>,
    use_simulation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(as = PacedTrainTrackOccupancy)]
pub(in crate::views) struct TrackOccupancy {
    #[serde(flatten)]
    #[schema(inline)]
    train_id: OccurrenceId,
    #[serde(flatten)]
    #[schema(inline)]
    time_window: TimeWindow,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct TrackSectionOccupancy {
    /// Local track name. Unset if trains occupy the operational point but the specific track is unknown.
    #[schema(inline)]
    local_track_name: Option<NonBlankString>,
    #[schema(inline)]
    trains: Vec<TrackOccupancy>,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(TrackOccupancyForm),
    responses(
        (status = 200, description = "Track section occupancy periods for train schedules",
         body = inline(Vec<TrackSectionOccupancy>)),
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
        train_schedule_ids,
        operational_point_reference,
        infra_id,
        timetable_id,
        electrical_profile_set_id,
        use_simulation,
    }): Json<TrackOccupancyForm>,
) -> Result<Json<Vec<TrackSectionOccupancy>>> {
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
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let train_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(
            conn,
            train_schedule_ids.clone(),
            |missing| TrainScheduleError::BatchNotFound {
                count: missing.len(),
            },
        )
        .await?;

    let mut exceptions = TrainScheduleException::retrieve_exceptions_by_train_schedules(
        conn,
        timetable_id,
        train_schedule_ids,
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.timetable_id);

    let (train_ids, trains): (Vec<_>, Vec<_>) = train_schedules
        .iter()
        .flat_map(|train_schedule| {
            train_schedule
                .iter_occurrences(&exceptions.remove(&train_schedule.id).unwrap_or_default())
                .collect::<Vec<_>>()
        })
        .unzip();

    let op_location =
        PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
            operational_point: operational_point_reference.clone(),
            local_track_name: None,
        });

    let path_items = trains
        .iter()
        .flat_map(|ts| &ts.path)
        .map(|p| &p.location)
        .chain(std::iter::once(&op_location))
        .collect_vec();

    let op_cache =
        OperationalPointCache::load_path_items(db_pool.get().await?, infra_id, &path_items).await?;

    let operational_point = op_cache
        .get_reference(operational_point_reference.clone())?
        .pop();

    let occupancies = match operational_point {
        Some(operational_point) => {
            if use_simulation {
                let simulation_params = TrackOccupancySimulationParams {
                    conn,
                    valkey_client,
                    core_client,
                    infra: &infra,
                    electrical_profile_set_id,
                    app_version: config.app_version.as_deref(),
                };
                find_track_occupancy_for_known_operational_point_with_simulation(
                    train_ids,
                    trains,
                    &op_cache,
                    operational_point,
                    simulation_params,
                )
                .await?
            } else {
                find_track_occupancy_for_known_operational_point_without_simulation(
                    train_ids,
                    trains,
                    &op_cache,
                    operational_point,
                )
            }
        }
        None => find_track_occupancy_unknown_operational_point(
            train_ids,
            trains,
            &operational_point_reference,
        ),
    };

    let results = occupancies
        .into_iter()
        .into_group_map()
        .into_iter()
        .map(|(local_track_name, trains)| TrackSectionOccupancy {
            local_track_name,
            trains,
        })
        .collect();

    Ok(Json(results))
}

struct TrackOccupancySimulationParams<'a> {
    conn: &'a mut DbConnection,
    valkey_client: Arc<cache::Client>,
    core_client: Arc<CoreClient>,
    infra: &'a Infra,
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&'a str>,
}

async fn find_track_occupancy_for_known_operational_point_with_simulation(
    train_ids: Vec<OccurrenceId>,
    train_occurrences: Vec<schemas::TrainOccurrence>,
    op_cache: &OperationalPointCache,
    operational_point: &OperationalPoint,
    simulation_params: TrackOccupancySimulationParams<'_>,
) -> Result<Vec<(Option<NonBlankString>, TrackOccupancy)>> {
    let operational_point_track_offsets = operational_point.track_offsets();

    let TrackOccupancySimulationParams {
        conn,
        valkey_client,
        core_client,
        infra,
        electrical_profile_set_id,
        app_version,
    } = simulation_params;

    let simulations_result = train_simulation_batch(
        conn,
        valkey_client,
        core_client,
        &train_occurrences,
        infra,
        electrical_profile_set_id,
        app_version,
    )
    .await?;

    Ok(izip!(train_ids, train_occurrences, simulations_result)
        .flat_map(|(train_id, train, (simulation, pathfinding))| {
            track_occupancy::find_track_occupancy_for_operational_point(
                &operational_point.id,
                &operational_point_track_offsets,
                op_cache,
                &simulation,
                &pathfinding,
                &train,
            )
            .into_iter()
            .map(
                move |track_occupancy::TrackOccupancy {
                          local_track_name,
                          time_window,
                      }| {
                    (
                        local_track_name,
                        TrackOccupancy {
                            train_id: train_id.clone(),
                            time_window,
                        },
                    )
                },
            )
        })
        .collect())
}

fn find_track_occupancy_for_known_operational_point_without_simulation(
    train_ids: Vec<OccurrenceId>,
    train_occurrences: Vec<schemas::TrainOccurrence>,
    op_cache: &OperationalPointCache,
    operational_point: &OperationalPoint,
) -> Vec<(Option<NonBlankString>, TrackOccupancy)> {
    let operational_point_track_offsets = operational_point.track_offsets();

    izip!(train_ids, train_occurrences)
        .flat_map(|(train_id, train_schedule)| {
            track_occupancy::find_track_occupancy_for_operational_point_without_simulation(
                &operational_point.id,
                &operational_point_track_offsets,
                op_cache,
                &train_schedule,
            )
            .into_iter()
            .map(
                move |track_occupancy::TrackOccupancy {
                          local_track_name,
                          time_window,
                      }| {
                    (
                        local_track_name,
                        TrackOccupancy {
                            train_id: train_id.clone(),
                            time_window,
                        },
                    )
                },
            )
        })
        .collect()
}

fn find_track_occupancy_unknown_operational_point(
    train_ids: Vec<OccurrenceId>,
    trains: Vec<schemas::TrainOccurrence>,
    operational_point_reference: &OperationalPointReference,
) -> Vec<(Option<NonBlankString>, TrackOccupancy)> {
    izip!(train_ids, trains)
        .flat_map(|(train_id, train_schedule)| {
            let schedule_per_path_item: HashMap<_, _> = train_schedule
                .schedule
                .iter()
                .map(|schedule_item| (&schedule_item.at, schedule_item))
                .collect();
            train_schedule
                .path
                .iter()
                .filter_map(|path_item| {
                    let PathItemLocation::OperationalPointPartReference(ref op_ref) =
                        path_item.location
                    else {
                        return None;
                    };
                    if op_ref.operational_point != *operational_point_reference {
                        return None;
                    }
                    let is_first_path_item = train_schedule
                        .path
                        .first()
                        .is_some_and(|first| first.id == path_item.id);
                    let time_window = schedule_per_path_item
                        .get(&path_item.id)
                        .and_then(|schedule_item| {
                            let duration = schedule_item.stop_for.unwrap_or_default();
                            let arrival_time = if is_first_path_item {
                                0
                            } else {
                                schedule_item.arrival?.num_milliseconds()
                            };
                            let time_begin =
                                train_schedule.start_time + Duration::milliseconds(arrival_time);
                            Some(TimeWindow {
                                time_begin,
                                duration,
                            })
                        })
                        // No schedule item for the first path item: use start_time directly.
                        .or_else(|| {
                            is_first_path_item.then_some(TimeWindow {
                                time_begin: train_schedule.start_time,
                                duration: Default::default(),
                            })
                        })?;
                    Some((
                        op_ref.local_track_name.clone(),
                        TrackOccupancy {
                            train_id: train_id.clone(),
                            time_window,
                        },
                    ))
                })
                .collect_vec()
        })
        .collect()
}

#[cfg_attr(test, derive(serde::Serialize))]
#[derive(Deserialize, ToSchema)]
pub(in crate::views) struct MoveTrainSchedulesForm {
    pub train_schedule_ids: Vec<i64>,
    pub train_schedule_set_id: i64,
}

#[editoast_derive::route]
#[utoipa::path(
    patch, path = "",
    tag = "train_schedule",
    request_body = inline(MoveTrainSchedulesForm),
    responses(
        (status = 204, description = "The train schedule set is updated with the train schedules"),
    ),
)]
pub(in crate::views) async fn move_train_schedules_to_another_train_schedule_set(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(MoveTrainSchedulesForm {
        train_schedule_ids,
        train_schedule_set_id,
    }): Json<MoveTrainSchedulesForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    TrainScheduleSet::exists_or_fail(&mut db_pool.get().await?, train_schedule_set_id, || {
        TrainScheduleError::TrainScheduleSetNotFound {
            train_schedule_set_id,
        }
    })
    .await?;

    let train_schedules: Vec<_> = models::TrainSchedule::retrieve_batch_or_fail(
        &mut db_pool.get().await?,
        train_schedule_ids.clone(),
        |missing| TrainScheduleError::BatchNotFound {
            count: missing.len(),
        },
    )
    .await?;

    // Filter train schedules ids to remove ones that are already in the provided train schedule set
    let train_schedule_ids = train_schedules
        .into_iter()
        .filter_map(|train_schedule| {
            if train_schedule.train_schedule_set_id != train_schedule_set_id {
                Some(train_schedule.id)
            } else {
                None
            }
        })
        .collect_vec();

    // Check if some train schedules are part of a round_trips
    let round_trips = TrainScheduleRoundTrips::retrieve_from_train_schedule_ids(
        &mut db_pool.get().await?,
        train_schedule_ids.clone(),
    )
    .await?;

    let mut to_break: Vec<i64> = vec![];

    for round_trip in round_trips {
        // We extract right_id, if it is None we skip the iteration
        let Some(right_id) = round_trip.right_id else {
            continue;
        };
        // If one of the two trains is not a train we want to move, we add the ID to to_break
        if !train_schedule_ids.contains(&right_id)
            || !train_schedule_ids.contains(&round_trip.left_id)
        {
            to_break.push(round_trip.id);
        }
    }

    TrainScheduleRoundTrips::delete_batch(&mut db_pool.get().await?, to_break).await?;

    // Update the train_schedule_set_id of the paced trains
    let _: (Vec<_>, _) = models::TrainSchedule::changeset()
        .train_schedule_set_id(train_schedule_set_id)
        .update_batch(&mut db_pool.get().await?, train_schedule_ids)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use chrono::DateTime;
    use chrono::Duration;
    use chrono::TimeDelta;
    use chrono::Utc;
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
    use editoast_models::TrainScheduleException;
    use editoast_models::prelude::*;
    use editoast_models::rolling_stock::TrainMainCategory;
    use editoast_models::timetable::Timetable;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::infra::Direction;
    use schemas::paced_train::InitialSpeedChangeGroup;
    use schemas::paced_train::Paced;
    use schemas::paced_train::RollingStockChangeGroup;
    use schemas::paced_train::TrainNameChangeGroup;
    use schemas::paced_train::TrainSchedule;
    use schemas::primitives::NonBlankString;
    use schemas::primitives::PositiveDuration;
    use schemas::rolling_stock::TrainCategory;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::OperationalPointPartReference;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::PathItem;
    use schemas::train_schedule::PathItemLocation;
    use schemas::train_schedule::ReceptionSignal;
    use schemas::train_schedule::ScheduleItem;
    use schemas::train_schedule::TrainOccurrence;
    use serde_json::json;

    use super::*;
    use crate::error::InternalError;
    use crate::models;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_paced_train_with_exceptions;
    use crate::models::fixtures::create_simple_paced_train;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::create_timetable_with_train_schedule_set;
    use crate::models::fixtures::create_train_schedule_exception;
    use crate::models::fixtures::create_train_schedule_set;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::models::fixtures::simple_paced_train_changeset;
    use crate::models::fixtures::simple_sub_category;
    use crate::models::train_schedule::OccurrenceId;
    use crate::models::train_schedule::TrainScheduleChangeset;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::test_app::TestResponse;
    use crate::views::tests::mocked_core_pathfinding_sim_and_proj;
    use crate::views::timetable::simulation;
    use crate::views::timetable::simulation::SimulationResponseSuccess;
    use crate::views::timetable::simulation::SummaryResponse;
    use crate::views::timetable::simulation_empty_response;

    pub fn new_op_with_trigram_and_local_track_name(
        id: &str,
        trigram: &str,
        secondary_code: Option<String>,
        local_track_name: Option<NonBlankString>,
    ) -> PathItem {
        PathItem {
            id: id.into(),
            location: PathItemLocation::OperationalPointPartReference(
                OperationalPointPartReference {
                    operational_point: OperationalPointReference::Trigram {
                        trigram: trigram.into(),
                        secondary_code,
                    },
                    local_track_name,
                },
            ),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule = simple_paced_train_base();
        // Insert train schedule
        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&json!(vec![train_schedule]));

        let response: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();
        assert_eq!(response.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_with_sub_category() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let created_sub_category = simple_sub_category(
            "tjv",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let mut train_schedule = simple_paced_train_base();
        train_schedule.train_occurrence.category = Some(TrainCategory::Sub {
            sub_category_code: created_sub_category.code.clone(),
        });

        // Insert train schedule
        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&json!(vec![train_schedule]));

        let response: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        assert_eq!(response.len(), 1);

        let created_paced_train =
            models::TrainSchedule::retrieve(pool.get_ok(), response.first().unwrap().id)
                .await
                .expect("Failed to retrieve updated paced train")
                .expect("Updated paced train not found");

        assert_eq!(
            created_paced_train.sub_category,
            Some(created_sub_category.code.clone())
        );
        let created_paced_train: schemas::paced_train::TrainSchedule = created_paced_train.into();

        assert_eq!(
            created_paced_train.train_occurrence.category,
            Some(TrainCategory::Sub {
                sub_category_code: created_sub_category.code.clone()
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let mut paced_train_base = simple_paced_train_base();
        paced_train_base.paced.as_mut().unwrap().time_window =
            Duration::minutes(90).try_into().unwrap();
        paced_train_base.paced.as_mut().unwrap().interval =
            Duration::minutes(15).try_into().unwrap();

        let request = app
            .put(format!("/train_schedules/{}", paced_train.id).as_str())
            .json(&json!(&paced_train_base));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let updated_paced_train = models::TrainSchedule::retrieve(pool.get_ok(), paced_train.id)
            .await
            .expect("Failed to retrieve updated paced train")
            .expect("Updated paced train not found");

        assert_eq!(paced_train_base, updated_paced_train.into());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let request = app
            .delete("/train_schedules/")
            .json(&json!({"ids": vec![train_schedule.id]}));

        let _ = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = models::TrainSchedule::exists(&mut pool.get_ok(), train_schedule.id)
            .await
            .expect("Failed to retrieve train_schedule");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_not_found_train_schedule() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/train_schedules/{}", 0));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:train_schedule:NotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let request = app.get(&format!("/train_schedules/{}", paced_train.id));

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<TrainScheduleResponse>();

        assert_eq!(response.train_schedule, paced_train.into());
    }

    async fn app_infra_id_paced_train_id_for_simulation_tests() -> (
        TestApp,
        i64,
        Timetable,
        models::TrainSchedule,
        TrainScheduleException,
    ) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let exception = TrainScheduleException::fixture_created("created_exception_key", None);

        let train_schedule_base = TrainSchedule {
            train_occurrence: TrainOccurrence {
                rolling_stock_name: rolling_stock.name.clone(),
                ..TrainOccurrence::fake()
            },
            paced: Some(Paced {
                time_window: Duration::hours(1).try_into().unwrap(),
                interval: Duration::minutes(15).try_into().unwrap(),
                exceptions: vec![],
            }),
        };
        let train_schedule: TrainScheduleChangeset = train_schedule_base.into();
        let train_schedule = train_schedule
            .train_schedule_set_id(train_schedule_set.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let exception = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("created_exception_key".to_string()),
            Some(exception.change_groups),
        )
        .await;

        let core = mocked_core_pathfinding_sim_and_proj();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();
        (app, small_infra.id, timetable, train_schedule, exception)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation() {
        let (app, infra_id, _timetable, train_schedule, _exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!(
                "/train_schedules/{}/simulation/?infra_id={infra_id}",
                train_schedule.id
            )
            .as_str(),
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
        let (app, infra_id, _timetable, train_schedule, _exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!(
                "/train_schedules/{}/simulation/?infra_id={infra_id}&exception_id=9999",
                train_schedule.id
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
            "editoast:train_schedule:ExceptionNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_exception_simulation() {
        let (app, infra_id, _timetable, train_schedule, exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!(
                "/train_schedules/{}/simulation/?infra_id={infra_id}&exception_id={}",
                train_schedule.id, exception.id
            )
            .as_str(),
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
                    positions: vec![0, 500_000, 15_050_000],
                    times: vec![0, 30_000, 100_000],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 1, 2, 3]
                },
                provisional: ReportTrain {
                    positions: vec![0, 500_000, 15_050_000],
                    times: vec![0, 30_000, 100_000],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 1, 2, 3]
                },
                final_output: CompleteReportTrain {
                    report_train: ReportTrain {
                        positions: vec![0, 500_000, 15_050_000],
                        times: vec![0, 30_000, 100_000],
                        speeds: vec![],
                        energy_consumption: 0.0,
                        path_item_times: vec![0, 1, 2, 3]
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
        let (app, infra_id, _timetable, train_schedule, exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;

        let mut change_groupe = exception.change_groups;
        change_groupe.rolling_stock = Some(RollingStockChangeGroup {
            rolling_stock_name: "R2D2".into(),
            comfort: Comfort::AirConditioning,
        });
        let exception = editoast_models::TrainScheduleException::changeset()
            .change_groups(change_groupe)
            .update(&mut app.db_pool().get_ok(), train_schedule.id)
            .await
            .expect("Fail to update exception")
            .expect("Fail to update exception");

        // WHEN
        let request = app.get(
            format!(
                "/train_schedules/{}/simulation/?infra_id={infra_id}&exception_id={}",
                train_schedule.id, exception.id
            )
            .as_str(),
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
        let (app, infra_id, _timetable, _train_schedule, _exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request =
            app.get(format!("/train_schedules/{}/simulation/?infra_id={}", 0, infra_id).as_str());

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:train_schedule:NotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary() {
        // Setup tests tools
        let core = mocked_core_pathfinding_sim_and_proj();
        let app = TestAppBuilder::new()
            .db_pool(DbConnectionPoolV2::for_tests())
            .core_client(core.into())
            .build();
        let db_pool = app.db_pool();

        // Setup tests data
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;

        let train_schedule = TrainSchedule {
            train_occurrence: schemas::TrainOccurrence::fake(),
            paced: Some(Paced {
                time_window: Duration::hours(1).try_into().unwrap(),
                interval: Duration::minutes(15).try_into().unwrap(),
                exceptions: vec![],
            }),
        };
        let train_schedule: TrainScheduleChangeset = train_schedule.into();
        let train_schedule = train_schedule
            .train_schedule_set_id(train_schedule_set.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        // Add one exception which will not change the simulation from base
        let _change_train_name_exception = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("change_train_name".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                train_name: Some(TrainNameChangeGroup {
                    value: "exception_name_but_same_simulation".into(),
                }),
                ..Default::default()
            }),
        )
        .await;

        // Add one exception which will change the simulation from base
        let _change_train_name_exception = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("change_initial_speed".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                initial_speed: Some(InitialSpeedChangeGroup { value: 1.23 }),
                ..Default::default()
            }),
        )
        .await;

        let request = app
            .post("/train_schedules/simulation_summary")
            .json(&json!({
                "infra_id": small_infra.id,
                "timetable_id": timetable.id,
                "ids": vec![train_schedule.id],
            }));

        let response: HashMap<i64, TrainScheduleSummaryResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(
            *response.get(&train_schedule.id).unwrap(),
            TrainScheduleSummaryResponse {
                train_schedule: SummaryResponse::Success {
                    length: 15_050_000,
                    time: 3,
                    energy_consumption: 0.0,
                    path_item_times_final: vec![0, 1, 2, 3],
                    path_item_times_provisional: vec![0, 1, 2, 3],
                    path_item_times_base: vec![0, 1, 2, 3],
                    path_item_respect_times: vec![true, false, true, false],
                    path_item_respect_margins: vec![true, true, true, true],
                },
                exceptions: [(
                    _change_train_name_exception.id.to_string(),
                    // Simulation of the exception is the same than base
                    // because all simulation results from core are identical stubs
                    SummaryResponse::Success {
                        length: 15_050_000,
                        time: 3,
                        energy_consumption: 0.0,
                        path_item_times_final: vec![0, 1, 2, 3],
                        path_item_times_provisional: vec![0, 1, 2, 3],
                        path_item_times_base: vec![0, 1, 2, 3],
                        path_item_respect_times: vec![true, false, true, false],
                        path_item_respect_margins: vec![true, true, true, true],
                    }
                )]
                .into_iter()
                .collect()
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary_not_found() {
        let (app, infra_id, _timetable, _paced_train_id, _exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let timetable = create_timetable(&mut app.db_pool().get_ok()).await;
        let request = app
            .post("/train_schedules/simulation_summary")
            .json(&json!({
                "infra_id": infra_id,
                "timetable_id": timetable.id,
                "ids": vec![0],
            }));
        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule:BatchNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_infra_not_found() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let request = app.get(&format!(
            "/train_schedules/{}/path?infra_id={}",
            paced_train.id, 0
        ));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule:InfraNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_not_found() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let small_infra = create_small_infra(&mut pool.get_ok()).await;

        let request = app.get(&format!(
            "/train_schedules/{}/path?infra_id={}",
            0, small_infra.id
        ));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:train_schedule:NotFound");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_with_invalid_exception_key() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let small_infra = create_small_infra(&mut pool.get_ok()).await;
        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;
        let request = app.get(
            format!(
                "/train_schedules/{}/path/?infra_id={}&exception_id=1234",
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
            "editoast:train_schedule:ExceptionNotFound"
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
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/train_schedules/{}/path?infra_id={}",
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
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

        let train_schedule = create_paced_train_with_exceptions(
            &mut db_pool.get_ok(),
            train_schedule_set.id,
            vec![],
        )
        .await;

        let change_rolling_stock_exception = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("exception_for_get_path".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                train_name: Some(TrainNameChangeGroup {
                    value: "exception_name_for_get_path".into(),
                }),
                rolling_stock: Some(RollingStockChangeGroup {
                    rolling_stock_name: "exception_rolling_stock".into(),
                    comfort: Comfort::Standard,
                }),
                ..Default::default()
            }),
        )
        .await;

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/train_schedules/{}/path?infra_id={}&exception_id={}",
            train_schedule.id, small_infra.id, change_rolling_stock_exception.id
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

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;

        let train_schedule = create_paced_train_with_exceptions(
            &mut db_pool.get_ok(),
            train_schedule_set.id,
            vec![],
        )
        .await;

        let change_train_name_exception = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("exception_for_get_path".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                train_name: Some(TrainNameChangeGroup {
                    value: "exception_name_for_get_path".into(),
                }),
                ..Default::default()
            }),
        )
        .await;

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/train_schedules/{}/path?infra_id={}&exception_id={}",
            train_schedule.id, small_infra.id, change_train_name_exception.id
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
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let _ = create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let paced_train_valid =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;
        let paced_train_fail = simple_paced_train_changeset(train_schedule_set.id)
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
        let request = app.post("/train_schedules/project_path").json(&json!({
            "infra_id": small_infra.id,
            "timetable_id": timetable.id,
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
        let response: HashMap<i64, ProjectPathTrainScheduleResult> = app
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
        let (app, infra_id, timetable, train_schedule, exception) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let db_pool = app.db_pool();

        // First remove all already generated exceptions
        exception
            .delete(&mut db_pool.get_ok())
            .await
            .expect("Failled to remove exception");

        // Add one exception which will not change the simulation from base
        let _exception1 = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("change_train_name".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                train_name: Some(TrainNameChangeGroup {
                    value: "exception_name_but_same_simulation".into(),
                }),
                ..Default::default()
            }),
        )
        .await;

        // Add one exception which will change the simulation from base
        let _exception1 = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("change_initial_speed".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                initial_speed: Some(InitialSpeedChangeGroup { value: 1.23 }),
                ..Default::default()
            }),
        )
        .await;

        let request = app.post("/train_schedules/occupancy_blocks").json(
            &json!({"ids": vec![train_schedule.id],
                "infra_id": infra_id,
                "timetable_id": timetable.id,
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
            }),
        );
        let response = app.fetch(request).await;
        let response: HashMap<i64, OccupancyBlocksTrainScheduleResult> =
            response.assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
        // TODO fix mocked simulation to return path item times that respect times
        assert_eq!(
            response
                .get(&train_schedule.id)
                .unwrap()
                .train_schedule
                .len(),
            0
        );
        assert_eq!(
            response.get(&train_schedule.id).unwrap().exceptions.len(),
            0
        );
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
        with_exception: bool,
        path: Vec<PathItem>,
        schedule: Vec<ScheduleItem>,
        operational_point_reference: OperationalPointReference,
        use_simulation: bool,
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
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let train_schedule = models::TrainSchedule::default()
            .into_changeset()
            .train_schedule_set_id(train_schedule_set.id)
            .rolling_stock_name(rolling_stock.name)
            .path(path)
            .schedule(schedule)
            .interval(TimeDelta::try_minutes(15))
            .time_window(TimeDelta::try_hours(1))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        if with_exception {
            TrainScheduleException::changeset()
                .timetable_id(timetable.id)
                .train_schedule_id(train_schedule.id)
                .change_groups(TrainScheduleExceptionChangeGroups::default())
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create exception");
        }

        let request = app
            .post("/train_schedules/track_occupancy")
            .json(&TrackOccupancyForm {
                train_schedule_ids: vec![train_schedule.id],
                operational_point_reference,
                infra_id: small_infra.id,
                timetable_id: timetable.id,
                electrical_profile_set_id: None,
                use_simulation,
            });

        app.fetch(request).await
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_track_occupancy_without_exceptions() {
        let response = init_paced_train_test(
            false,
            vec![
                PathItem::new_operational_point("Mid_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
            ],
            vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )],
            OperationalPointReference::Id {
                operational_point: "Mid_West_station".into(),
            },
            true,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert_eq!(track_occupancies.len(), 1);
        let item = &track_occupancies[0];
        assert_eq!(
            item.local_track_name,
            Some(NonBlankString("V2".to_string()))
        );
        assert_eq!(item.trains.len(), 4);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_track_occupancy_with_exceptions() {
        let response = init_paced_train_test(
            true,
            vec![
                PathItem::new_operational_point("Mid_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
            ],
            vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )],
            OperationalPointReference::Id {
                operational_point: "Mid_West_station".into(),
            },
            true,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert_eq!(track_occupancies.len(), 1);
        let item = &track_occupancies[0];
        assert_eq!(
            item.local_track_name,
            Some(NonBlankString("V2".to_string()))
        );
        assert_eq!(item.trains.len(), 5);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_returns_empty_track_occupancies() {
        let response = init_paced_train_test(
            false,
            vec![
                PathItem::new_operational_point("Mid_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
            ],
            vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )],
            OperationalPointReference::Id {
                operational_point: "West_station".into(),
            },
            true,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert!(track_occupancies.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn move_train_schedules_to_another_train_schedule_set() {
        let app = TestAppBuilder::new().build();
        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get_ok()).await;
        let train_schedule =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;

        let train_schedule_set_to_move = create_train_schedule_set(&mut db_pool.get_ok()).await;

        let move_form = MoveTrainSchedulesForm {
            train_schedule_ids: vec![train_schedule.id],
            train_schedule_set_id: train_schedule_set_to_move.id,
        };
        let request = app.patch("/train_schedules/move").json(&move_form);

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let train_schedule = models::TrainSchedule::retrieve(db_pool.get_ok(), train_schedule.id)
            .await
            .expect("Failed to retrieve train schedule");
        assert_eq!(
            train_schedule.unwrap().train_schedule_set_id,
            train_schedule_set_to_move.id
        );
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(true)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(false)]
    async fn track_occupancy_unknown_op_returns_path_item_local_track_name(
        #[case] use_simulation: bool,
    ) {
        let response = init_paced_train_test(
            false,
            vec![
                new_op_with_trigram_and_local_track_name("Mid_West_station", "MWS", None, None),
                new_op_with_trigram_and_local_track_name(
                    "UNKNOWN_ID",
                    "UNKNOWN_TRIGRAM",
                    None,
                    Some(NonBlankString("UNKNOWN_V".to_string())),
                ),
                new_op_with_trigram_and_local_track_name("Mid_East_station", "MES", None, None),
            ],
            vec![
                ScheduleItem {
                    at: "UNKNOWN_ID".into(),
                    arrival: Some(PositiveDuration::new(
                        Duration::new(300, 0).expect("Failed to parse duration"),
                    )),
                    stop_for: Some(PositiveDuration::new(
                        Duration::new(120, 0).expect("Failed to parse duration"),
                    )),
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem::new_with_stop(
                    "Mid_East_station",
                    Duration::new(0, 0).expect("Failed to parse duration"),
                ),
            ],
            OperationalPointReference::Trigram {
                trigram: "UNKNOWN_TRIGRAM".into(),
                secondary_code: None,
            },
            use_simulation,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();
        assert_eq!(track_occupancies.len(), 1);
        assert_eq!(
            track_occupancies[0].local_track_name,
            Some(NonBlankString("UNKNOWN_V".to_string()))
        );
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(None)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(Some(NonBlankString("UNKNOWN_V".to_string())))]
    async fn track_occupancy_no_sim_known_op_returns_local_track_name(
        #[case] local_track_name: Option<NonBlankString>,
    ) {
        let first_path_item = PathItem {
            id: "Mid_West_station".into(),
            location: PathItemLocation::OperationalPointPartReference(
                OperationalPointPartReference {
                    operational_point: OperationalPointReference::Id {
                        operational_point: "Mid_West_station".into(),
                    },
                    local_track_name: local_track_name.clone(),
                },
            ),
        };
        let response = init_paced_train_test(
            false,
            vec![
                first_path_item,
                PathItem::new_operational_point("Mid_East_station"),
            ],
            vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )],
            OperationalPointReference::Id {
                operational_point: "Mid_West_station".into(),
            },
            false,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert_eq!(track_occupancies.len(), 1);
        assert_eq!(track_occupancies[0].local_track_name, local_track_name);
        assert_eq!(track_occupancies[0].trains.len(), 4);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn track_occupancy_no_sim_no_arrival_returns_empty() {
        let response = init_paced_train_test(
            false,
            vec![
                PathItem::new_operational_point("Mid_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
                PathItem::new_operational_point("North_station"),
            ],
            vec![
                ScheduleItem::new_with_stop(
                    "Mid_East_station",
                    Duration::new(60, 0).expect("Failed to parse duration"),
                ),
                ScheduleItem::new_with_stop(
                    "North_station",
                    Duration::new(0, 0).expect("Failed to parse duration"),
                ),
            ],
            OperationalPointReference::Id {
                operational_point: "Mid_East_station".into(),
            },
            false,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();

        assert!(track_occupancies.is_empty());
    }

    #[test]
    fn unknown_op_without_local_track_name_has_null_reference() {
        let op_ref = OperationalPointReference::Trigram {
            trigram: "UNKNOWN".into(),
            secondary_code: None,
        };
        let path_item = PathItem {
            id: "item_1".into(),
            location: PathItemLocation::OperationalPointPartReference(
                OperationalPointPartReference {
                    operational_point: op_ref.clone(),
                    local_track_name: None,
                },
            ),
        };
        let train_schedule = schemas::TrainOccurrence {
            path: vec![path_item.clone()],
            schedule: vec![ScheduleItem {
                at: "item_1".into(),
                arrival: Some(PositiveDuration::try_from(Duration::seconds(100)).unwrap()),
                stop_for: Some(PositiveDuration::try_from(Duration::seconds(60)).unwrap()),
                reception_signal: ReceptionSignal::Open,
            }],
            ..Default::default()
        };
        let train_id = OccurrenceId::new_base(42, 0);

        let mut result = find_track_occupancy_unknown_operational_point(
            vec![train_id],
            vec![train_schedule],
            &op_ref,
        );

        assert_eq!(result.len(), 1);
        let (local_track_name, _train_occupancy) = result.remove(0);
        assert_eq!(local_track_name, None);
    }

    #[test]
    fn unknown_op_non_first_item_without_arrival_returns_none() {
        let op_ref = OperationalPointReference::Trigram {
            trigram: "UNKNOWN".into(),
            secondary_code: None,
        };
        let path_item = PathItem {
            id: "item_1".into(),
            location: PathItemLocation::OperationalPointPartReference(
                OperationalPointPartReference {
                    operational_point: op_ref.clone(),
                    local_track_name: None,
                },
            ),
        };
        let train_schedule = schemas::TrainOccurrence {
            path: vec![
                PathItem::new_operational_point("Mid_West_station"),
                path_item.clone(),
            ],
            schedule: vec![ScheduleItem {
                at: "item_1".into(),
                arrival: None,
                stop_for: None,
                reception_signal: ReceptionSignal::Open,
            }],
            ..Default::default()
        };
        let train_id = OccurrenceId::new_base(1, 0);

        let result = find_track_occupancy_unknown_operational_point(
            vec![train_id],
            vec![train_schedule],
            &op_ref,
        );

        assert!(result.is_empty());
    }

    #[test]
    fn unknown_op_first_path_item_no_arrival_uses_start_time() {
        let op_ref = OperationalPointReference::Trigram {
            trigram: "UNKNOWN".into(),
            secondary_code: None,
        };
        let start_time: DateTime<Utc> = "2026-01-01T00:00:00Z".parse().unwrap();
        let train_schedule = schemas::TrainOccurrence {
            start_time,
            path: vec![
                PathItem {
                    id: "item_1".into(),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: op_ref.clone(),
                            local_track_name: None,
                        },
                    ),
                },
                PathItem::new_operational_point("Mid_West_station"),
            ],
            schedule: vec![ScheduleItem {
                at: "Mid_West_station".into(),
                arrival: Some(PositiveDuration::try_from(Duration::seconds(100)).unwrap()),
                stop_for: Some(PositiveDuration::try_from(Duration::seconds(60)).unwrap()),
                reception_signal: ReceptionSignal::Open,
            }],
            ..Default::default()
        };

        let result = find_track_occupancy_unknown_operational_point(
            vec![OccurrenceId::new_base(1, 0)],
            vec![train_schedule],
            &op_ref,
        );

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].1.time_window.time_begin, start_time);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn track_occupancy_op_in_db_but_not_in_path_items() {
        let response = init_paced_train_test(
            false,
            vec![
                PathItem::new_operational_point("South_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
            ],
            vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )],
            OperationalPointReference::Id {
                operational_point: "Mid_West_station".into(),
            },
            true,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status(StatusCode::OK).json_into();
        assert!(!track_occupancies.is_empty());
    }
}
