pub mod stdcm;

use std::collections::HashMap;
use std::ops::DerefMut as _;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use derivative::Derivative;
use editoast_derive::EditoastError;
use editoast_schemas::train_schedule::TrainScheduleBase;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::core::v2::conflict_detection::Conflict;
use crate::core::v2::conflict_detection::ConflictDetectionRequest;
use crate::core::v2::conflict_detection::TrainRequirements;
use crate::core::v2::simulation::SimulationResponse;
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::timetable::TimetableWithTrains;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::train_schedule::TrainScheduleChangeset;
use crate::modelsv2::Infra;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;
use crate::views::v2::train_schedule::train_simulation_batch;
use crate::views::v2::train_schedule::TrainScheduleForm;
use crate::views::v2::train_schedule::TrainScheduleResult;
use crate::AppState;
use crate::RetrieveBatch;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
    "/v2/timetable" => {
        post,
        list,
        "/{id}" => {
            delete,
            get,
            put,
            "/conflicts" => conflicts,
            "/train_schedule" => train_schedule,
            &stdcm,
        },
    },
}

editoast_common::schemas! {
    TimetableForm,
    TimetableResult,
    TimetableDetailedResult,
    stdcm::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "timetable")]
enum TimetableError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { timetable_id: i64 },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

/// Creation form for a Timetable
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct TimetableForm {
    #[serde(default)]
    pub electrical_profile_set_id: Option<i64>,
}

/// Creation form for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, Derivative, ToSchema)]
struct TimetableResult {
    pub id: i64,
    pub electrical_profile_set_id: Option<i64>,
}

impl From<Timetable> for TimetableResult {
    fn from(timetable: Timetable) -> Self {
        Self {
            id: timetable.id,
            electrical_profile_set_id: timetable.electrical_profile_set_id,
        }
    }
}

/// Creation form for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, Derivative, ToSchema)]
struct TimetableDetailedResult {
    #[serde(flatten)]
    #[schema(inline)]
    pub timetable: TimetableResult,
    pub train_ids: Vec<i64>,
}

impl From<TimetableWithTrains> for TimetableDetailedResult {
    fn from(val: TimetableWithTrains) -> Self {
        Self {
            timetable: TimetableResult {
                id: val.id,
                electrical_profile_set_id: val.electrical_profile_set_id,
            },
            train_ids: val.train_ids,
        }
    }
}

#[derive(IntoParams, Deserialize)]
struct TimetableIdParam {
    /// A timetable ID
    id: i64,
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    get, path = "",
    tag = "timetablev2",
    params(TimetableIdParam),
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableDetailedResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn get(
    db_pool: State<DbConnectionPoolV2>,
    Path(timetable_id): Path<TimetableIdParam>,
) -> Result<Json<TimetableDetailedResult>> {
    let timetable_id = timetable_id.id;
    // Return the timetable

    let conn = &mut db_pool.get().await?;
    let timetable = TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || {
        TimetableError::NotFound { timetable_id }
    })
    .await?;

    Ok(Json(timetable.into()))
}

#[derive(Serialize, ToSchema)]
struct ListTimetablesResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<TimetableResult>,
}

/// Retrieve paginated timetables
#[utoipa::path(
    get, path = "",
    tag = "timetablev2",
    params(PaginationQueryParam),
    responses(
        (status = 200, description = "List timetables", body = inline(ListTimetablesResponse)),
    ),
)]
async fn list(
    db_pool: State<DbConnectionPoolV2>,
    Query(pagination_params): Query<PaginationQueryParam>,
) -> Result<Json<ListTimetablesResponse>> {
    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings();
    let (timetables, stats) =
        Timetable::list_paginated(db_pool.get().await?.deref_mut(), settings).await?;
    Ok(Json(ListTimetablesResponse {
        stats,
        results: timetables.into_iter().map_into().collect(),
    }))
}

/// Create a timetable
#[utoipa::path(
    post, path = "",
    tag = "timetablev2",
    request_body = TimetableForm,
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn post(
    db_pool: State<DbConnectionPoolV2>,
    Json(data): Json<TimetableForm>,
) -> Result<Json<TimetableResult>> {
    let conn = &mut db_pool.get().await?;

    let elec_profile_set = data.electrical_profile_set_id;
    let changeset = Timetable::changeset().electrical_profile_set_id(elec_profile_set);
    let timetable = changeset.create(conn).await?;

    Ok(Json(timetable.into()))
}

/// Update a specific timetable
#[utoipa::path(
    put, path = "",
    tag = "timetablev2",
    params(TimetableIdParam),
    request_body = TimetableForm,
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableDetailedResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn put(
    db_pool: State<DbConnectionPoolV2>,
    timetable_id: Path<TimetableIdParam>,
    data: Json<TimetableForm>,
) -> Result<Json<TimetableDetailedResult>> {
    let timetable_id = timetable_id.id;
    let conn = &mut db_pool.get().await?;

    let elec_profile_set = data.electrical_profile_set_id;
    let changeset = Timetable::changeset().electrical_profile_set_id(elec_profile_set);
    changeset
        .update_or_fail(conn, timetable_id, || TimetableError::NotFound {
            timetable_id,
        })
        .await?;

    let timetable = TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || {
        TimetableError::NotFound { timetable_id }
    })
    .await?;
    Ok(Json(timetable.into()))
}

/// Delete a timetable
#[utoipa::path(
    delete, path = "",
    tag = "timetablev2",
    params(TimetableIdParam),
    responses(
        (status = 204, description = "No content"),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn delete(
    db_pool: State<DbConnectionPoolV2>,
    timetable_id: Path<TimetableIdParam>,
) -> Result<impl IntoResponse> {
    let timetable_id = timetable_id.id;
    let conn = &mut db_pool.get().await?;
    Timetable::delete_static_or_fail(conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Create train schedule by batch
#[utoipa::path(
    post, path = "",
    tag = "timetablev2,train_schedulev2",
    params(TimetableIdParam),
    request_body = Vec<TrainScheduleBase>,
    responses(
        (status = 200, description = "The created train schedules", body = Vec<TrainScheduleResult>)
    )
)]
async fn train_schedule(
    db_pool: State<DbConnectionPoolV2>,
    Path(timetable_id): Path<TimetableIdParam>,
    Json(data): Json<Vec<TrainScheduleBase>>,
) -> Result<Json<Vec<TrainScheduleResult>>> {
    let conn = &mut db_pool.get().await?;

    let timetable_id = timetable_id.id;
    TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;

    let changesets: Vec<TrainScheduleChangeset> = data
        .into_iter()
        .map(|ts| TrainScheduleForm {
            timetable_id: Some(timetable_id),
            train_schedule: ts,
        })
        .map_into()
        .collect();

    // Create a batch of train_schedule
    let train_schedule: Vec<_> = TrainSchedule::create_batch(conn, changesets).await?;
    Ok(Json(train_schedule.into_iter().map_into().collect()))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct InfraIdQueryParam {
    infra_id: i64,
}

/// Retrieve the list of conflict of the timetable (invalid trains are ignored)
#[utoipa::path(
    get, path = "",
    tag = "timetablev2",
    params(TimetableIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "List of conflict", body = Vec<ConflictV2>),
    ),
)]
async fn conflicts(
    app_state: State<AppState>,
    Path(timetable_id): Path<TimetableIdParam>,
    Query(query): Query<InfraIdQueryParam>,
) -> Result<Json<Vec<Conflict>>> {
    let db_pool = app_state.db_pool_v2.clone();
    let redis_client = app_state.redis.clone();
    let core_client = app_state.core_client.clone();

    let timetable_id = timetable_id.id;
    let infra_id = query.infra_id;

    // 1. Retrieve Timetable / Infra / Trains / Simultion
    let timetable_trains = TimetableWithTrains::retrieve_or_fail(
        db_pool.get().await?.deref_mut(),
        timetable_id,
        || TimetableError::NotFound { timetable_id },
    )
    .await?;

    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        TimetableError::InfraNotFound { infra_id }
    })
    .await?;

    let (trains, _): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(db_pool.get().await?.deref_mut(), timetable_trains.train_ids)
            .await?;

    let simulations = train_simulation_batch(
        db_pool.get().await?.deref_mut(),
        redis_client.clone(),
        core_client.clone(),
        &trains,
        &infra,
    )
    .await?;

    // 2. Build core request
    let mut trains_requirements = HashMap::with_capacity(trains.len());
    for (train, sim) in trains.into_iter().zip(simulations) {
        let (sim, _) = sim;
        let final_output = match sim {
            SimulationResponse::Success { final_output, .. } => final_output,
            _ => continue,
        };
        trains_requirements.insert(
            train.id,
            TrainRequirements {
                start_time: train.start_time,
                spacing_requirements: final_output.spacing_requirements,
                routing_requirements: final_output.routing_requirements,
            },
        );
    }
    let conflict_detection_request = ConflictDetectionRequest {
        trains_requirements,
    };

    // 3. Call core
    let conflicts = conflict_detection_request.fetch(&core_client).await?;

    Ok(Json(conflicts.conflicts))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::modelsv2::fixtures::create_timetable;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn get_timetable() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(pool.get_ok().deref_mut()).await;

        let request = app.get(&format!("/v2/timetable/{}", timetable.id));

        let timetable_from_response: Timetable =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(timetable_from_response, timetable);
    }

    #[rstest]
    async fn get_unexisting_timetable() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/v2/timetable/{}", 0));
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_timetable_list() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        create_timetable(pool.get_ok().deref_mut()).await;

        let request = app.get("/v2/timetable/");

        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn timetable_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Insert timetable
        let request = app
            .post("/v2/timetable")
            .json(&json!({ "electrical_profil_set_id": None::<i64>}));

        let created_timetable: Timetable =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let retrieved_timetable =
            Timetable::retrieve(pool.get_ok().deref_mut(), created_timetable.id)
                .await
                .expect("Failed to retrieve timetable")
                .expect("Timetable not found");

        assert_eq!(created_timetable, retrieved_timetable);
    }

    #[rstest]
    async fn timetable_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(pool.get_ok().deref_mut()).await;

        let request = app.delete(format!("/v2/timetable/{}", timetable.id).as_str());

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Timetable::exists(pool.get_ok().deref_mut(), timetable.id)
            .await
            .expect("Failed to check if timetable exists");

        assert!(!exists);
    }
}
