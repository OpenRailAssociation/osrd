use std::collections::HashMap;
use std::collections::HashSet;

use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::train_schedule::TrainSchedule;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::models;
use crate::models::infra::Infra;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdQueryParam;
use crate::views::path::PathfindingError;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding::pathfinding_from_train;
use crate::views::projection::ProjectPathForm;
use crate::views::projection::ProjectPathTrainResult;
use crate::views::projection::compute_projected_train_paths;
use crate::views::timetable::simulation;

use super::simulation::SummaryResponse;
use super::simulation::train_simulation_batch;

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
    TrainSchedule,
    TrainScheduleForm,
    TrainScheduleResponse,
    ElectricalProfileSetIdQueryParam,
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
            train_schedule: TrainSchedule {
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
                category: value.category.as_deref().cloned(),
            },
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
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainScheduleResponse)
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
) -> Result<Json<TrainScheduleResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    #[expect(deprecated)]
    let train_schedule = models::TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(train_schedule.into()))
}

#[derive(Debug, Deserialize, ToSchema)]
struct TrainScheduleIds {
    ids: HashSet<i64>,
}

/// Delete a train schedule and its result
#[utoipa::path(
    delete, path = "",
    tag = "timetable,train_schedule",
    request_body = inline(TrainScheduleIds),
    responses(
        (status = 204, description = "All train schedules have been deleted")
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(TrainScheduleIds { ids: train_ids }): Json<TrainScheduleIds>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
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
#[utoipa::path(
    put, path = "",
    tag = "train_schedule,timetable",
    request_body = TrainScheduleForm,
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule have been updated", body = TrainScheduleResponse)
    )
)]
async fn put(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Json(train_schedule_form): Json<TrainScheduleForm>,
) -> Result<Json<TrainScheduleResponse>> {
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
) -> Result<Json<simulation::Response>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Retrieve infra or fail
    #[expect(deprecated)]
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    // Retrieve train_schedule or fail
    #[expect(deprecated)]
    let train_schedule = models::TrainSchedule::retrieve_or_fail(
        &mut db_pool.get().await?,
        train_schedule_id,
        || TrainScheduleError::NotFound { train_schedule_id },
    )
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
) -> Result<Json<HashMap<i64, SummaryResponse>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    #[expect(deprecated)]
    let infra = Infra::retrieve_or_fail(conn, infra_id, || TrainScheduleError::InfraNotFound {
        infra_id,
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
    )
    .await?;

    // Transform simulations to simulation summary
    let mut simulation_summaries = HashMap::new();
    for (train_schedule, sim) in train_schedules.iter().zip(simulations) {
        let (sim, _) = sim;
        let simulation_summary_result = SummaryResponse::from(sim);
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

    #[expect(deprecated)]
    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;
    #[expect(deprecated)]
    let train_schedule = models::TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
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

    let trains_schedules: Vec<models::TrainSchedule> =
        models::TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
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
    use crate::models::fixtures::PartialProjectPathTrainResult;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_simple_train_schedule;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_train_schedule_base;
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
            .json_into::<TrainScheduleResponse>();

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

        let response: Vec<TrainScheduleResponse> =
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

        let exists = models::TrainSchedule::exists(&mut pool.get_ok(), train_schedule.id)
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

        let response: TrainScheduleResponse =
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
            format!("/train_schedule/{train_schedule_id}/simulation/?infra_id={infra_id}").as_str(),
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
