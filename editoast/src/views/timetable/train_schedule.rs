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
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::TrainSchedule;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::simulation::SummaryResponse;
use super::simulation::train_simulation_batch;
use crate::AppState;
use crate::error::Result;
use crate::models;
use crate::models::OperationalPointModel;
use crate::models::RollingStock;
use crate::models::infra::Infra;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdQueryParam;
use crate::views::path::PathfindingError;
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
use crate::views::timetable::SimulationResponseSuccess;
use crate::views::timetable::occupancy_blocks::OccupancyBlockForm;
use crate::views::timetable::occupancy_blocks::OccupancyBlocks;
use crate::views::timetable::occupancy_blocks::compute_occupancy_blocks;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::build_path_items_to_position;
use crate::views::timetable::simulation::build_sim_power_restriction_items;
use crate::views::timetable::simulation::build_sim_schedule_items;
use crate::views::timetable::track_occupancy;

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
    #[error("Operational point '{operational_point_id}', could not be found")]
    #[editoast_error(status = 404)]
    OperationalPointNotFound { operational_point_id: String },
    #[error("Rolling stock '{rolling_stock_name}', could not be found")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_name: String },
    #[error("Pathfinding failed for train schedule '{train_schedule_id}'")]
    #[editoast_error(status = 404)]
    PathfindingFailed { train_schedule_id: i64 },
    #[error("Simulation failed for train schedule '{train_schedule_id}'")]
    #[editoast_error(status = 404)]
    SimulationFailed { train_schedule_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct TrainScheduleIdParam {
    /// A train schedule ID
    id: i64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleResponse {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    pub train_schedule: TrainSchedule,
}

impl From<models::TrainSchedule> for TrainScheduleResponse {
    fn from(value: models::TrainSchedule) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            train_schedule: TrainSchedule::from(value),
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleForm {
    /// Timetable attached to the train schedule
    pub timetable_id: Option<i64>,
    #[serde(flatten)]
    pub train_schedule: TrainSchedule,
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
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainScheduleResponse)
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
) -> Result<Json<TrainScheduleResponse>> {
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
    Ok(Json(train_schedule.into()))
}

#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleIds {
    ids: HashSet<i64>,
}

/// Delete a train schedule and its result
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
    Json(TrainScheduleIds { ids: train_ids }): Json<TrainScheduleIds>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    models::TrainSchedule::delete_batch_or_fail(conn, train_ids, |number| {
        TrainScheduleError::BatchTrainScheduleNotFound { number }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Update  train schedule at once
#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tags = ["train_schedule", "timetable"],
    request_body = TrainScheduleForm,
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule have been updated", body = TrainScheduleResponse)
    )
)]
pub(in crate::views) async fn put(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Json(train_schedule_form): Json<TrainScheduleForm>,
) -> Result<Json<TrainScheduleResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
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
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(TrainScheduleIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
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
) -> Result<Json<simulation::Response>> {
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

    // Retrieve train_schedule or fail
    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(db_pool.get().await?, train_schedule_id, || {
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
    params(TrainScheduleIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
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

    // Retrieve train_schedule or fail
    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(db_pool.get().await?, train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

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
        train_schedule.rolling_stock_name.clone(),
        || TrainScheduleError::RollingStockNotFound {
            rolling_stock_name: train_schedule.rolling_stock_name.clone(),
        },
    )
    .await?;
    let physics_consist: PhysicsConsist =
        PhysicsConsistParameters::from_traction_engine(rs.into()).into();

    // Build schedule items and power restrictions
    let path_items_to_position = build_path_items_to_position(
        train_schedule.path(),
        &pathfinding_response.path_item_positions,
    );
    let schedule = build_sim_schedule_items(train_schedule.schedule(), &path_items_to_position);
    let power_restrictions = build_sim_power_restriction_items(
        train_schedule.power_restrictions(),
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

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub(in crate::views) struct SimulationBatchForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    ids: HashSet<i64>,
}

/// Associate each train id with its simulation summary response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(SimulationBatchForm),
    responses(
        (status = 200, description = "Associate each train id with its simulation summary", body = HashMap<i64, simulation::SummaryResponse>),
    ),
)]
pub(in crate::views) async fn simulation_summary(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client: core,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(SimulationBatchForm {
        infra_id,
        electrical_profile_set_id,
        ids: train_schedule_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, SummaryResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
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

    let train_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_schedule_ids, |missing| {
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
        config.app_version.as_deref(),
    )
    .await?;

    // Transform simulations to simulation summary
    let mut simulation_summaries = HashMap::new();
    for (train_schedule, (sim, path)) in train_schedules.iter().zip(simulations) {
        let simulation_summary_result = SummaryResponse::summarize_simulation(
            Arc::unwrap_or_clone(sim),
            Arc::unwrap_or_clone(path),
        );
        simulation_summaries.insert(train_schedule.id, simulation_summary_result);
    }

    Ok(Json(simulation_summaries))
}

/// Get a path from a trainschedule given an infrastructure id and a train schedule id
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["train_schedule", "pathfinding"],
    params(TrainScheduleIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "The path", body = PathfindingResult),
        (status = 404, description = "Infrastructure or Train schedule not found")
    )
)]
pub(in crate::views) async fn get_path(
    State(AppState {
        config,
        db_pool,
        valkey_client,
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
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = db_pool.get().await?;
    let mut valkey_conn = valkey_client.get_connection().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        PathfindingError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(conn.clone(), train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;
    Ok(Json(
        pathfinding_from_train(
            conn,
            &mut valkey_conn,
            core,
            &infra,
            train_schedule,
            config.app_version.as_deref(),
        )
        .await?,
    ))
}

/// Projects the space time curves and paths of a number of train schedules onto a given path
///
/// - Returns 404 if the infra or any of the train schedules are not found
/// - Returns 200 with a hashmap of train_id to ProjectPathTrainResult
///
/// Train schedules that are invalid (pathfinding or simulation failed) are not included in the result
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = ProjectPathForm,
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<i64, Vec<SpaceTimeCurve>>),
    ),
)]
pub(in crate::views) async fn project_path(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(ProjectPathForm {
        infra_id,
        ids: train_ids,
        track_section_ranges,
        electrical_profile_set_id,
    }): Json<ProjectPathForm>,
) -> Result<Json<HashMap<i64, Vec<SpaceTimeCurve>>>> {
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

    let trains_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;

    let compute_project_path = compute_projected_train_paths(
        conn,
        core_client,
        valkey_client,
        track_section_ranges,
        infra,
        &trains_schedules,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    let project_path_result = compute_project_path
        .into_iter()
        .zip(trains_schedules)
        .map(|(result, train_schedule)| (train_schedule.id, Arc::unwrap_or_clone(result)))
        .collect();
    Ok(Json(project_path_result))
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(ProjectPathOperationalPointForm),
    responses(
        (status = 200, description = "Project train schedules on a list of operational points.", body = HashMap<i64, Vec<SpaceTimeCurve>>),
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
) -> Result<Json<HashMap<i64, Arc<Vec<SpaceTimeCurve>>>>> {
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
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;

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
        .flat_map(|ts| ts.path().iter().map(|p| &p.location))
        .chain(&path_item_locations_projection)
        .collect();

    let path_item_cache = PathItemCache::load(conn, infra.id, &path_item_locations).await?;

    let operational_points_projection = OperationalPointProjection::new(
        operational_points_refs,
        operational_points_distances,
        &path_item_cache,
    )?;

    let compute_project_path_op = compute_projected_train_path_op(
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

    let results: HashMap<_, _> = train_schedules
        .into_iter()
        .zip(compute_project_path_op)
        .map(|(ts, result)| (ts.id, result))
        .collect();

    Ok(Json(results))
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = OccupancyBlockForm,
    responses(
        (status = 200, body = HashMap<i64, Vec<SignalUpdate>>),
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
        ids: train_ids,
        path,
        electrical_profile_set_id,
    }): Json<OccupancyBlockForm>,
) -> Result<Json<HashMap<i64, OccupancyBlocks>>> {
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

    let train_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;

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

    let mut results = HashMap::new();

    occupancy_blocks_result
        .into_iter()
        .zip(train_schedules)
        .for_each(|(occupancy_blocks, train_schedule)| {
            results.insert(train_schedule.id, Arc::unwrap_or_clone(occupancy_blocks));
        });
    Ok(Json(results))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrackOccupancyForm {
    train_schedule_ids: Vec<i64>,
    operational_point_id: String,
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrackOccupancy {
    train_schedule_id: i64,
    #[serde(flatten)]
    #[schema(inline)]
    time_window: track_occupancy::TimeWindow,
}

/// Calculates when and for how long trains occupy track sections at a specific operational point.
/// Returns a map of track sections to their occupation periods, containing:
/// - time_begin: Start of occupation
/// - duration: Length of occupation (includes stops)
/// - train_schedule_id: Train schedule ID
///
/// If a path item ID is provided, it uses schedule data to determine stop duration and location.
/// If not, it infers the position and time based on track offsets and interpolation.
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(TrackOccupancyForm),
    responses(
        (status = 200, description = "Track section occupancy periods for a set of train schedules", body = inline(HashMap<String, Vec<TrackOccupancy>>)),
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

    // Retrieve infra / train_schedules / operational points
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    let train_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(
            &mut db_pool.get().await?,
            train_schedule_ids,
            |missing| TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            },
        )
        .await?;

    let operational_point = OperationalPointModel::retrieve_or_fail(
        db_pool.get().await?,
        (infra_id, operational_point_id.clone()),
        || TrainScheduleError::OperationalPointNotFound {
            operational_point_id: operational_point_id.clone(),
        },
    )
    .await?;

    // Retrieve simulations
    let simulations_result = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client,
        core_client,
        &train_schedules,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    let operational_point_track_offsets = operational_point.schema.track_offset();

    let path_items = train_schedules
        .iter()
        .flat_map(|ts| ts.path.iter().map(|p| &p.location))
        .collect::<Vec<_>>();

    let path_item_cache =
        PathItemCache::load(&mut db_pool.get().await?, infra_id, &path_items).await?;

    let track_occupancy_map = simulations_result
        .iter()
        .zip(train_schedules)
        .flat_map(|((simulation, pathfinding), train_schedule)| {
            let train_schedule_schema: TrainSchedule = train_schedule.clone().into();
            let train_schedule_id = train_schedule.id;

            track_occupancy::find_track_occupancy_for_operational_point(
                &operational_point_id,
                &operational_point_track_offsets,
                &path_item_cache,
                simulation,
                pathfinding,
                &train_schedule_schema,
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
                            train_schedule_id,
                            time_window,
                        },
                    )
                },
            )
        })
        .collect::<Vec<_>>();

    let track_occupancy_map = track_occupancy_map.into_iter().fold(
        HashMap::<String, Vec<TrackOccupancy>>::new(),
        |mut track_occupancy_map, (track_section, track_occupancy)| {
            track_occupancy_map
                .entry(track_section)
                .or_default()
                .push(track_occupancy);
            track_occupancy_map
        },
    );
    Ok(Json(track_occupancy_map))
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use chrono::DateTime;
    #[cfg(test)]
    use core_client::mocking::MockingClient;
    use editoast_models::rolling_stock::TrainMainCategory;
    use pretty_assertions::assert_eq;
    use schemas::rolling_stock::TrainCategory;
    use serde_json::json;

    use super::*;

    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_simple_train_schedule;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_sub_category;
    use crate::models::fixtures::simple_train_schedule_base;
    use crate::models::fixtures::simple_train_schedule_changeset;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::tests::mocked_core_pathfinding_and_sim;
    use crate::views::tests::mocked_core_pathfinding_sim_and_proj;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_get() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;

        let url = format!("/train_schedule/{}", train_schedule.id);
        let request = app.get(&url);

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<TrainScheduleResponse>();

        assert_eq!(train_schedule.id, response.id);
        assert_eq!(train_schedule.timetable_id, response.timetable_id);
        assert_eq!(
            train_schedule.initial_speed,
            response.train_schedule.initial_speed
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule_base = simple_train_schedule_base();

        // Insert train_schedule
        let request = app
            .post(format!("/timetable/{}/train_schedules", timetable.id).as_str())
            .json(&json!(vec![train_schedule_base]));

        let response: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
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

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let mut train_schedule_base = simple_train_schedule_base();
        train_schedule_base.category = Some(TrainCategory::Sub {
            sub_category_code: created_sub_category.code.clone(),
        });

        // Insert train_schedule
        let request = app
            .post(format!("/timetable/{}/train_schedules", timetable.id).as_str())
            .json(&json!(vec![train_schedule_base]));

        let response: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.len(), 1);

        let created_train_schedule =
            models::TrainSchedule::retrieve(pool.get_ok(), response.first().unwrap().id)
                .await
                .expect("Failed to retrieve updated train schedule")
                .expect("Updated train schedule not found");

        assert_eq!(
            created_train_schedule.sub_category,
            Some(created_sub_category.code.clone())
        );
        let created_train_schedule: schemas::TrainSchedule = created_train_schedule.into();

        assert_eq!(
            created_train_schedule.category,
            Some(TrainCategory::Sub {
                sub_category_code: created_sub_category.code.clone()
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule = create_simple_train_schedule(&mut pool.get_ok(), timetable.id).await;

        let request = app
            .delete("/train_schedule/")
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

        let response: TrainScheduleResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            response.train_schedule.rolling_stock_name,
            update_train_schedule_form.train_schedule.rolling_stock_name
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_put_with_category() {
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
        let train_schedule = simple_train_schedule_changeset(timetable.id)
            .sub_category(Some(created_sub_category.code))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create train schedule");
        let train_schedule_id = train_schedule.id;

        let update_train_schedule = schemas::TrainSchedule {
            category: Some(TrainCategory::Main {
                main_category: schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
            }),
            ..train_schedule.into()
        };

        let update_train_schedule_form = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: update_train_schedule,
        };

        let request = app
            .put(format!("/train_schedule/{train_schedule_id}").as_str())
            .json(&json!(update_train_schedule_form));

        let response: TrainScheduleResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            response.train_schedule.category,
            update_train_schedule_form.train_schedule.category
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_put_with_none_category() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let created_sub_category = simple_sub_category(
            "NRER",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let train_schedule = simple_train_schedule_changeset(timetable.id)
            .sub_category(Some(created_sub_category.code))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create train schedule");
        let train_schedule_id = train_schedule.id;

        let update_train_schedule = schemas::TrainSchedule {
            category: None,
            ..train_schedule.into()
        };

        let update_train_schedule_form = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: update_train_schedule,
        };

        let request = app
            .put(format!("/train_schedule/{train_schedule_id}").as_str())
            .json(&json!(update_train_schedule_form));

        let response: TrainScheduleResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let updated_train_schedule = models::TrainSchedule::retrieve(pool.get_ok(), response.id)
            .await
            .expect("Failed to retrieve updated train schedule")
            .expect("Updated train schedule not found");

        assert_eq!(updated_train_schedule.main_category, None);
        assert_eq!(updated_train_schedule.sub_category, None);
    }

    async fn app_infra_id_train_schedule_id_for_simulation_tests() -> (TestApp, i64, i64) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let train_schedule_base = TrainSchedule {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule: Changeset<models::TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: train_schedule_base,
        }
        .into();
        let train_schedule = train_schedule
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");
        let core = mocked_core_pathfinding_sim_and_proj();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();
        (app, small_infra.id, train_schedule.id)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_simulation() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_train_schedule_id_for_simulation_tests().await;
        let request = app.get(
            format!("/train_schedule/{train_schedule_id}/simulation/?infra_id={infra_id}").as_str(),
        );
        app.fetch(request).await.assert_status(StatusCode::OK);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_simulation_summary() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_train_schedule_id_for_simulation_tests().await;
        let request = app.post("/train_schedule/simulation_summary").json(&json!({
            "infra_id": infra_id,
            "ids": vec![train_schedule_id],
        }));
        app.fetch(request).await.assert_status(StatusCode::OK);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_project_path() {
        // SETUP
        let db_pool = DbConnectionPoolV2::for_tests();

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let train_schedule_base = TrainSchedule {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule: Changeset<models::TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: train_schedule_base.clone(),
        }
        .into();
        let train_schedule_valid = train_schedule
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        let train_schedule_fail: Changeset<models::TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: TrainSchedule {
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

        let core = mocked_core_pathfinding_sim_and_proj();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();

        // TEST
        let request = app.post("/train_schedule/project_path").json(&json!({
            "infra_id": small_infra.id,
            "electrical_profile_set_id": null,
            "ids": vec![train_schedule_fail.id, train_schedule_valid.id],
            "track_section_ranges": [
                {
                    "track_section": "TA1",
                    "begin": 0,
                    "end": 100,
                    "direction": "START_TO_STOP"
                },
            ],
        }));
        let response: HashMap<i64, Vec<SpaceTimeCurve>> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        // EXPECT
        // TODO: improve this test
        assert_eq!(response.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_track_occupancy_fake_operational_point_id() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let train_schedule_base = TrainSchedule {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!(
                "../../tests/track_occupancy/simple_train_schedule.json"
            ))
            .expect("Unable to parse")
        };

        let train_schedule: Changeset<models::TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: train_schedule_base.clone(),
        }
        .into();
        let train_schedule_valid = train_schedule
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        let core = mocked_core_pathfinding_and_sim();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();

        let request = app.post("/train_schedule/track_occupancy").json(
            &json!({"train_schedule_ids": [train_schedule_valid.id],
                "operational_point_id": "fake_station_id",
                "infra_id": small_infra.id
            }),
        );

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_track_occupancy_pathfinding_failure() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let train_schedule_base = TrainSchedule {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!(
                "../../tests/track_occupancy/simple_train_schedule.json"
            ))
            .expect("Unable to parse")
        };

        let train_schedule: Changeset<models::TrainSchedule> = TrainScheduleForm {
            timetable_id: Some(timetable.id),
            train_schedule: train_schedule_base.clone(),
        }
        .into();
        let train_schedule_valid = train_schedule
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "status": "not_found_in_tracks"
            }))
            .finish();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();

        let request = app.post("/train_schedule/track_occupancy").json(
            &json!({"train_schedule_ids": [train_schedule_valid.id],
                "operational_point_id": "South_West_station",
                "infra_id": small_infra.id
            }),
        );
        let response: HashMap<String, Vec<TrackOccupancy>> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response.len(), 0);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_occupancy_blocks() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_train_schedule_id_for_simulation_tests().await;

        let request =
            app.post("/train_schedule/occupancy_blocks")
                .json(&json!({"ids": [train_schedule_id],
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
        let response: HashMap<i64, OccupancyBlocks> =
            response.assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(response.get(&train_schedule_id).unwrap().len(), 1);
    }
}
