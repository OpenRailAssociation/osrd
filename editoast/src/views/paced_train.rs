use std::collections::HashMap;
use std::collections::HashSet;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::paced_train::PacedTrainBase;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::path::pathfinding::PathfindingResult;
use super::projection::ProjectPathForm;
use super::AppState;
use super::AuthenticationExt;
use super::InfraIdQueryParam;
use super::SimulationSummaryResult;
use crate::core::simulation::SimulationResponse;
use crate::error::Result;
use crate::models::paced_train::PacedTrain;
use crate::models::prelude::*;
use crate::views::projection::ProjectPathTrainResult;
use crate::views::AuthorizationError;
use crate::views::ListId;

crate::routes! {
    "/paced_train" => {
        delete,
        "/project_path" => project_path,
        "/simulation_summary" => simulation_summary,
        "/{id}" => {
            get_by_id,
            update_paced_train,
            "/path" => get_path,
            "/simulation" => simulation,
        },
    },
}

editoast_common::schemas! {
    PacedTrainResult,
    PacedTrainForm,
    PacedTrainBase,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "paced_train")]
enum PacedTrainError {
    #[error("{count} paced train(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchPacedTrainNotFound { count: usize },
    #[editoast_error(status = 404)]
    #[error("Paced train {paced_train_id} does not exist")]
    PacedTrainNotFound { paced_train_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PacedTrainForm {
    /// Timetable attached to the train schedule
    pub timetable_id: Option<i64>,
    #[serde(flatten)]
    pub paced_train_base: PacedTrainBase,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct PacedTrainResult {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    paced_train: PacedTrainBase,
}

impl From<PacedTrain> for PacedTrainResult {
    fn from(value: PacedTrain) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            paced_train: value.into(),
        }
    }
}

#[derive(Debug, IntoParams, Deserialize)]
struct PacedTrainIdParam {
    id: i64,
}

/// Get a paced train by its ID
#[utoipa::path(
    get, path = "",
    tag = "timetable,paced_train",
    params(PacedTrainIdParam),
    responses(
        (status = 204, body = PacedTrainResult, description = "The requested paced train")
    )
)]
async fn get_by_id(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::OperationalStudies, BuiltinRole::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let paced_train = PacedTrain::retrieve_or_fail(conn, paced_train_id, || {
        PacedTrainError::PacedTrainNotFound { paced_train_id }
    })
    .await?;

    let paced_train: PacedTrainResult = paced_train.into();

    Ok(Json(paced_train))
}

/// Delete a paced train
#[utoipa::path(
    delete, path = "",
    tag = "timetable,paced_train",
    request_body = inline(ListId),
    responses(
        (status = 204, description = "All paced_trains have been deleted")
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(ListId {
        ids: paced_train_ids,
    }): Json<ListId>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    PacedTrain::delete_batch_or_fail(conn, paced_train_ids, |count| {
        PacedTrainError::BatchPacedTrainNotFound { count }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put, path = "",
    tag = "timetable,paced_train",
    request_body = PacedTrainForm,
    params(PacedTrainIdParam),
    responses(
        (status = 200, description = "Paced train have been updated", body = PacedTrainResult)
    )
)]
async fn update_paced_train(
    State(_db_pool): State<DbConnectionPoolV2>,
    Extension(_auth): AuthenticationExt,
    Path(PacedTrainIdParam {
        id: _paced_train_id,
    }): Path<PacedTrainIdParam>,
    Json(_paced_train_form): Json<PacedTrainForm>,
) -> Result<Json<PacedTrainResult>> {
    todo!();
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
struct SimulationBatchForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    ids: HashSet<i64>,
}

/// Associate each paced train id with its simulation summaries response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[utoipa::path(
    post, path = "",
    tag = "paced_train",
    request_body = inline(SimulationBatchForm),
    responses(
        (status = 200, description = "Associate each paced train id with its simulation summaries", body = HashMap<i64, SimulationSummaryResult>),
    ),
)]
async fn simulation_summary(
    State(AppState {
        db_pool: _db_pool,
        valkey: _valkey_client,
        core_client: _core,
        ..
    }): State<AppState>,
    Extension(_auth): AuthenticationExt,
    Json(SimulationBatchForm {
        infra_id: _infra_id,
        electrical_profile_set_id: _electrical_profile_set_id,
        ids: _paced_train_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, SimulationSummaryResult>>> {
    todo!();
}

/// Get a path from a paced train given an infrastructure id and a paced train id
#[utoipa::path(
    get, path = "",
    tag = "paced_train,pathfinding",
    params(PacedTrainIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "The path", body = PathfindingResult),
        (status = 404, description = "Infrastructure or Train schedule not found")
    )
)]
async fn get_path(
    State(AppState {
        db_pool: _db_pool,
        valkey: _valkey_client,
        core_client: _core,
        ..
    }): State<AppState>,
    Extension(_auth): AuthenticationExt,
    Path(PacedTrainIdParam {
        id: _paced_train_id,
    }): Path<PacedTrainIdParam>,
    Query(InfraIdQueryParam {
        infra_id: _infra_id,
    }): Query<InfraIdQueryParam>,
) -> Result<Json<PathfindingResult>> {
    todo!();
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct ElectricalProfileSetIdQueryParam {
    electrical_profile_set_id: Option<i64>,
}

/// Retrieve the space, speed and time curve of a given train
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(PacedTrainIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "Simulation Output", body = SimulationResponse),
    ),
)]
async fn simulation(
    State(AppState {
        valkey: _valkey_client,
        core_client: _core_client,
        db_pool: _db_pool,
        ..
    }): State<AppState>,
    Extension(_auth): AuthenticationExt,
    Path(PacedTrainIdParam {
        id: _paced_train_id,
    }): Path<PacedTrainIdParam>,
    Query(InfraIdQueryParam {
        infra_id: _infra_id,
    }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id: _electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<SimulationResponse>> {
    todo!();
}

/// Projects the space time curves and paths of a number of paced trains onto a given path
///
/// - Returns 404 if the infra or any of the paced trains are not found
/// - Returns 200 with a hashmap of train_id to ProjectPathTrainResult
///
/// Paced trains that are invalid (pathfinding or simulation failed) are not included in the result
#[utoipa::path(
    post, path = "",
    tag = "paced_train",
    request_body = ProjectPathForm,
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<i64, ProjectPathTrainResult>),
    ),
)]
async fn project_path(
    State(AppState {
        db_pool: _db_pool,
        valkey: _valkey_client,
        core_client: _core_client,
        ..
    }): State<AppState>,
    Extension(_auth): AuthenticationExt,
    Json(ProjectPathForm {
        infra_id: _infra_id,
        ids: _paced_train_ids,
        path: _path,
        electrical_profile_set_id: _electrical_profile_set_id,
    }): Json<ProjectPathForm>,
) -> Result<Json<HashMap<i64, ProjectPathTrainResult>>> {
    todo!();
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use crate::error::InternalError;
    use crate::models::fixtures::create_simple_paced_train;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::models::paced_train::PacedTrain;
    use crate::models::prelude::*;
    use crate::views::paced_train::PacedTrainResult;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn paced_train_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train_base = simple_paced_train_base();
        // Insert paced_train
        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&json!(vec![paced_train_base]));

        let response: Vec<PacedTrainResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
    }

    #[rstest]
    async fn paced_train_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let request = app
            .delete("/paced_train/")
            .json(&json!({"ids": vec![paced_train.id]}));

        let _ = app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = PacedTrain::exists(&mut pool.get_ok(), paced_train.id)
            .await
            .expect("Failed to retrieve paced_train");

        assert!(!exists);
    }

    #[rstest]
    async fn get_not_found_paced_train() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/paced_train/{}", 0));

        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:paced_train:PacedTrainNotFound"
        )
    }

    #[rstest]
    async fn get_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let request = app.get(&format!("/paced_train/{}", paced_train.id));

        let response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<PacedTrainResult>();

        assert_eq!(paced_train.id, response.id);
        assert_eq!(paced_train.timetable_id, response.timetable_id);
        assert_eq!(
            paced_train.duration,
            response.paced_train.paced.duration.into()
        );
        assert_eq!(paced_train.step, response.paced_train.paced.step.into());
    }
}
