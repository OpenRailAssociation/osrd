use std::collections::HashMap;
use std::collections::HashSet;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::paced_train::PacedTrainBase;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::path::pathfinding::pathfinding_from_train;
use super::path::pathfinding::PathfindingResult;
use super::projection::compute_projected_train_paths;
use super::projection::ProjectPathForm;
use super::train_schedule::train_simulation_batch;
use super::AppState;
use super::AuthenticationExt;
use super::InfraIdQueryParam;
use super::SimulationSummaryResult;
use crate::core::simulation::SimulationResponse;
use crate::error::Result;
use crate::models::paced_train::PacedTrain;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;
use crate::models::Infra;
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
    BatchNotFound { count: usize },
    #[error("Paced train '{paced_train_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { paced_train_id: i64 },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PacedTrainForm {
    /// Timetable attached to the paced train
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
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let paced_train = PacedTrain::retrieve_or_fail(conn, paced_train_id, || {
        PacedTrainError::NotFound { paced_train_id }
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
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    PacedTrain::delete_batch_or_fail(conn, paced_train_ids, |count| {
        PacedTrainError::BatchNotFound { count }
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
        db_pool,
        valkey: valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(SimulationBatchForm {
        infra_id,
        electrical_profile_set_id,
        ids: paced_train_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, SimulationSummaryResult>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn, infra_id, || PacedTrainError::InfraNotFound {
        infra_id,
    })
    .await?;

    let paced_trains: Vec<PacedTrain> =
        PacedTrain::retrieve_batch_or_fail(conn, paced_train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;
    let paced_trains_to_ts: Vec<TrainSchedule> = paced_trains
        .iter()
        .cloned()
        .map(PacedTrain::into_first_occurrence)
        .collect();

    let simulations = train_simulation_batch(
        conn,
        valkey_client,
        core_client,
        &paced_trains_to_ts,
        &infra,
        electrical_profile_set_id,
    )
    .await?;

    // Transform simulations to simulation summary
    let simulation_summaries = paced_trains
        .into_iter()
        .zip(simulations)
        .map(|(paced_train, (sim, _))| (paced_train.id, SimulationSummaryResult::from(sim)))
        .collect();

    Ok(Json(simulation_summaries))
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
        db_pool,
        valkey: valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(PacedTrainIdParam { id: paced_train_id }): Path<PacedTrainIdParam>,
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

    let infra = Infra::retrieve_or_fail(conn, infra_id, || PacedTrainError::InfraNotFound {
        infra_id,
    })
    .await?;
    let paced_train = PacedTrain::retrieve_or_fail(conn, paced_train_id, || {
        PacedTrainError::NotFound { paced_train_id }
    })
    .await?;
    Ok(Json(
        pathfinding_from_train(
            conn,
            &mut valkey_conn,
            core_client,
            &infra,
            paced_train.into_first_occurrence(),
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
        valkey: valkey_client,
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
) -> Result<Json<SimulationResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        PacedTrainError::InfraNotFound { infra_id }
    })
    .await?;

    // Retrieve paced_train or fail
    let paced_train =
        PacedTrain::retrieve_or_fail(&mut db_pool.get().await?, paced_train_id, || {
            PacedTrainError::NotFound { paced_train_id }
        })
        .await?;

    // Compute simulation of a paced_train
    let (simulation, _) = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client,
        core_client,
        &[paced_train.into_first_occurrence()],
        &infra,
        electrical_profile_set_id,
    )
    .await?
    .pop()
    .unwrap();

    Ok(Json(simulation))
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
        db_pool,
        valkey: valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(ProjectPathForm {
        infra_id,
        ids: paced_train_ids,
        path,
        electrical_profile_set_id,
    }): Json<ProjectPathForm>,
) -> Result<Json<HashMap<i64, ProjectPathTrainResult>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let paced_trains: Vec<PacedTrain> =
        PacedTrain::retrieve_batch_or_fail(conn, paced_train_ids, |missing| {
            PacedTrainError::BatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let first_occurrences: Vec<TrainSchedule> = paced_trains
        .into_iter()
        .map(|p| p.into_first_occurrence())
        .collect();

    let project_path_result = compute_projected_train_paths(
        conn,
        core_client,
        valkey_client,
        path,
        infra_id,
        first_occurrences,
        electrical_profile_set_id,
    )
    .await?;

    Ok(Json(project_path_result))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use chrono::DateTime;
    use chrono::Duration;
    use editoast_models::DbConnectionPoolV2;
    use editoast_schemas::paced_train::Paced;
    use editoast_schemas::paced_train::PacedTrainBase;
    use editoast_schemas::train_schedule::TrainScheduleBase;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use crate::core::mocking::MockingClient;
    use crate::core::pathfinding::PathfindingResultSuccess;
    use crate::core::simulation::CompleteReportTrain;
    use crate::core::simulation::ElectricalProfiles;
    use crate::core::simulation::ReportTrain;
    use crate::core::simulation::SimulationResponse;
    use crate::core::simulation::SpeedLimitProperties;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_simple_paced_train;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::models::fixtures::simple_paced_train_changeset;
    use crate::models::fixtures::PartialProjectPathTrainResult;
    use crate::models::paced_train::PacedTrain;
    use crate::models::paced_train::PacedTrainChangeset;
    use crate::models::prelude::*;
    use crate::views::paced_train::PacedTrainResult;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::tests::mocked_core_pathfinding_sim_and_proj;
    use crate::views::InternalError;
    use crate::views::SimulationSummaryResult;

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

        assert_eq!(&response.error_type, "editoast:paced_train:NotFound")
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

    async fn app_infra_id_paced_train_id_for_simulation_tests() -> (TestApp, i64, i64) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let paced_train_base: PacedTrainBase = PacedTrainBase {
            train_schedule_base: TrainScheduleBase {
                rolling_stock_name: rolling_stock.name.clone(),
                ..serde_json::from_str(include_str!("../tests/train_schedules/simple.json"))
                    .expect("Unable to parse")
            },
            paced: Paced {
                duration: Duration::hours(1).try_into().unwrap(),
                step: Duration::minutes(15).try_into().unwrap(),
            },
        };
        let paced_train: PacedTrainChangeset = paced_train_base.into();
        let paced_train = paced_train
            .timetable_id(timetable.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");
        let core = mocked_core_pathfinding_sim_and_proj(paced_train.id);
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        (app, small_infra.id, paced_train.id)
    }

    #[rstest]
    async fn paced_train_simulation() {
        let (app, infra_id, train_schedule_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.get(
            format!(
                "/paced_train/{}/simulation/?infra_id={}",
                train_schedule_id, infra_id
            )
            .as_str(),
        );
        let response: SimulationResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(
            response,
            SimulationResponse::Success {
                base: ReportTrain {
                    positions: vec![],
                    times: vec![],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 1000, 2000, 3000]
                },
                provisional: ReportTrain {
                    positions: vec![],
                    times: vec![],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 1000, 2000, 3000]
                },
                final_output: CompleteReportTrain {
                    report_train: ReportTrain {
                        positions: vec![0],
                        times: vec![0],
                        speeds: vec![],
                        energy_consumption: 0.0,
                        path_item_times: vec![0, 1000, 2000, 3000]
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
            }
        );
    }

    #[rstest]
    async fn paced_train_simulation_not_found() {
        let (app, infra_id, _paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request =
            app.get(format!("/paced_train/{}/simulation/?infra_id={}", 0, infra_id).as_str());

        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:NotFound")
    }

    #[rstest]
    async fn paced_train_simulation_summary() {
        let (app, infra_id, paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.post("/paced_train/simulation_summary").json(&json!({
            "infra_id": infra_id,
            "ids": vec![paced_train_id],
        }));
        let response: HashMap<i64, SimulationSummaryResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(
            *response.get(&paced_train_id).unwrap(),
            SimulationSummaryResult::Success {
                length: 0,
                time: 0,
                energy_consumption: 0.0,
                path_item_times_final: vec![0, 1000, 2000, 3000],
                path_item_times_provisional: vec![0, 1000, 2000, 3000],
                path_item_times_base: vec![0, 1000, 2000, 3000]
            }
        );
    }

    #[rstest]
    async fn paced_train_simulation_summary_not_found() {
        let (app, infra_id, _paced_train_id) =
            app_infra_id_paced_train_id_for_simulation_tests().await;
        let request = app.post("/paced_train/simulation_summary").json(&json!({
            "infra_id": infra_id,
            "ids": vec![0],
        }));
        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:BatchNotFound")
    }

    #[rstest]
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
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:InfraNotFound")
    }

    #[rstest]
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
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();

        assert_eq!(&response.error_type, "editoast:paced_train:NotFound");
    }

    #[rstest]
    async fn get_paced_train_path() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();
        core.stub("/v2/pathfinding/blocks")
            .method(reqwest::Method::POST)
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
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app.get(&format!(
            "/paced_train/{}/path?infra_id={}",
            paced_train.id, small_infra.id
        ));

        let response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<PathfindingResult>();

        assert_eq!(
            response,
            PathfindingResult::Success(PathfindingResultSuccess {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![],
                path_item_positions: vec![],
                length: 1
            })
        )
    }

    #[rstest]
    async fn paced_train_project_path() {
        // SETUP
        let db_pool = DbConnectionPoolV2::for_tests();

        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let train_schedule_base = TrainScheduleBase {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let paced_train_valid =
            create_simple_paced_train(&mut db_pool.get_ok(), timetable.id).await;
        let paced_train_fail = simple_paced_train_changeset(timetable.id)
            .rolling_stock_name("fail".to_string())
            .start_time(DateTime::from_timestamp(0, 0).unwrap())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let core = mocked_core_pathfinding_sim_and_proj(paced_train_valid.id);
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();

        // TEST
        let request = app.post("/paced_train/project_path").json(&json!({
            "infra_id": small_infra.id,
            "electrical_profile_set_id": null,
            "ids": vec![paced_train_fail.id, paced_train_valid.id],
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
            response[&paced_train_valid.id].departure_time,
            train_schedule_base.start_time
        );
    }
}
