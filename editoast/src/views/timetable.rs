pub mod stdcm;

use std::collections::HashMap;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::paced_train::PacedTrainBase;
use editoast_schemas::train_schedule::TrainScheduleBase;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::paced_train::PacedTrainResult;
use super::pagination::PaginatedList as _;
use super::pagination::PaginationQueryParams;
use super::pagination::PaginationStats;
use super::path::pathfinding::PathfindingResult;
use crate::core::conflict_detection::Conflict as CoreConflict;
use crate::core::conflict_detection::ConflictDetectionRequest;
use crate::core::conflict_detection::ConflictRequirement;
use crate::core::conflict_detection::ConflictType;
use crate::core::conflict_detection::PacedTrainOccurrenceId;
use crate::core::conflict_detection::TrainId;
use crate::core::conflict_detection::TrainRequirements;
use crate::core::simulation::SimulationResponse;
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::models::paced_train::PacedTrain;
use crate::models::paced_train::PacedTrainChangeset;
use crate::models::prelude::*;
use crate::models::timetable::Timetable;
use crate::models::timetable::TimetableWithTrains;
use crate::models::train_schedule::TrainSchedule;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::models::Infra;
use crate::views::train_schedule::train_simulation_batch;
use crate::views::train_schedule::TrainScheduleForm;
use crate::views::train_schedule::TrainScheduleResult;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use crate::RetrieveBatch;

crate::routes! {
    "/timetable" => {
        post,
        "/{id}" => {
            delete,
            "/train_schedules" => {
                 get_train_schedules,
                 post_train_schedule,
            },
            "/conflicts" => conflicts,
            "/paced_trains" => {
                get_paced_trains,
                post_paced_train,
            },
            &stdcm,
        },
    },
}

editoast_common::schemas! {
    Conflict,
    TimetableResult,
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
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
    #[error("Failed to parse train_id '{train_id}'")]
    #[editoast_error(status = 500)]
    ParseError { train_id: String },
}

/// Creation result for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, Derivative, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
struct TimetableResult {
    pub timetable_id: i64,
}

impl From<Timetable> for TimetableResult {
    fn from(timetable: Timetable) -> Self {
        Self {
            timetable_id: timetable.id,
        }
    }
}

#[derive(IntoParams, Deserialize)]
struct TimetableIdParam {
    /// A timetable ID
    id: i64,
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(Deserialize))]
struct ListTrainSchedulesResponse {
    #[schema(value_type = Vec<TrainScheduleResult>)]
    results: Vec<TrainScheduleResult>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams),
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = inline(ListTrainSchedulesResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn get_train_schedules(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams>,
) -> Result<Json<ListTrainSchedulesResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let timetable_exists = Timetable::exists(conn, timetable_id).await?;
    if !timetable_exists {
        return Err(TimetableError::NotFound { timetable_id }.into());
    }

    let settings = pagination_params
        .validate(25)?
        .into_selection_settings()
        .filter(move || TrainSchedule::TIMETABLE_ID.eq(timetable_id));

    let (train_schedules, stats) = TrainSchedule::list_paginated(conn, settings).await?;
    let results = train_schedules.into_iter().map_into().collect();

    Ok(Json(ListTrainSchedulesResponse { stats, results }))
}

/// Create a timetable
#[utoipa::path(
    post, path = "",
    tag = "timetable",
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn post(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<TimetableResult>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let timetable = Timetable::changeset().create(conn).await?;

    Ok(Json(timetable.into()))
}

/// Delete a timetable
#[utoipa::path(
    delete, path = "",
    tag = "timetable",
    params(TimetableIdParam),
    responses(
        (status = 204, description = "No content"),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    tag = "timetable,train_schedule",
    params(TimetableIdParam),
    request_body = Vec<TrainScheduleBase>,
    responses(
        (status = 200, description = "The created train schedules", body = Vec<TrainScheduleResult>)
    )
)]
async fn post_train_schedule(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(train_schedules): Json<Vec<TrainScheduleBase>>,
) -> Result<Json<Vec<TrainScheduleResult>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let timetable_exists = Timetable::exists(conn, timetable_id).await?;
    if !timetable_exists {
        return Err(TimetableError::NotFound { timetable_id }.into());
    }

    let changesets: Vec<TrainScheduleChangeset> = train_schedules
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

/// Create paced trains by batch
#[utoipa::path(
    post, path = "",
    tag = "timetable,paced_train",
    params(TimetableIdParam),
    request_body = Vec<PacedTrainBase>,
    responses(
        (status = 200, description = "The created paced trains", body = Vec<PacedTrainResult>)
    )
)]
async fn post_paced_train(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(paced_trains): Json<Vec<PacedTrainBase>>,
) -> Result<Json<Vec<PacedTrainResult>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let timetable_exists = Timetable::exists(conn, timetable_id).await?;
    if !timetable_exists {
        return Err(TimetableError::NotFound { timetable_id }.into());
    }

    let changesets = paced_trains
        .into_iter()
        .map(PacedTrainChangeset::from)
        .map(|cs| cs.timetable_id(timetable_id))
        .collect::<Vec<_>>();

    // Create a batch of paced trains
    let paced_trains: Vec<_> = PacedTrain::create_batch(conn, changesets).await?;
    Ok(Json(paced_trains.into_iter().map_into().collect()))
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(Deserialize))]
struct ListPacedTrainsResponse {
    #[schema(value_type = Vec<PacedTrainResult>)]
    results: Vec<PacedTrainResult>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated paced trains
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams),
    responses(
        (status = 200, description = "Timetable with paced train ids", body = inline(ListPacedTrainsResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn get_paced_trains(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams>,
) -> Result<Json<ListPacedTrainsResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let timetable_exists = Timetable::exists(conn, timetable_id).await?;
    if !timetable_exists {
        return Err(TimetableError::NotFound { timetable_id }.into());
    }

    let settings = pagination_params
        .validate(25)?
        .into_selection_settings()
        .filter(move || PacedTrain::TIMETABLE_ID.eq(timetable_id));

    let (paced_trains, stats) = PacedTrain::list_paginated(conn, settings).await?;

    let results = paced_trains.into_iter().map_into().collect();

    Ok(Json(ListPacedTrainsResponse { stats, results }))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct InfraIdQueryParam {
    infra_id: i64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct ElectricalProfileSetIdQueryParam {
    electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct Conflict {
    /// List of train schedule ids involved in the conflict
    pub train_schedule_ids: Vec<i64>,
    /// List of paced train occurrences involved in the conflict.
    /// Each occurrence is identified by a `paced_train_id` and its `index`
    #[schema(inline)]
    pub paced_train_occurrence_ids: Vec<PacedTrainOccurrenceId>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<i64>,
    /// Datetime of the start of the conflict
    pub start_time: DateTime<Utc>,
    /// Datetime of the end of the conflict
    pub end_time: DateTime<Utc>,
    /// Type of the conflict
    #[schema(inline)]
    pub conflict_type: ConflictType,
    /// List of requirements causing the conflict
    pub requirements: Vec<ConflictRequirement>,
}

impl Conflict {
    /// Converts the conflict data into a `ViewConflict` format.
    ///
    /// This function processes train schedule ids and paced trains generated ids ("paced_train_id#occurrence_id}")
    ///  and maps them to either a `train_schedule_id` or a `paced_train_occurrence_id` based on the provided key mapping.
    /// The train_id_map follows this structure:
    /// - `train_id: (train_schedule_id, None)` if `train_id` corresponds to a train schedule ID.
    /// - `train_id: (paced_train_id, occurrence_id)` if `train_id` corresponds to a generated paced train ID.
    fn into_conflict_response(
        conflict: CoreConflict,
        train_id_map: HashMap<String, TrainId>,
    ) -> Result<Self> {
        let mut train_schedule_ids = Vec::new();
        let mut paced_train_occurrence_ids = Vec::new();

        for train_id in &conflict.train_ids {
            if let Some(train_id) = train_id_map.get(train_id) {
                match train_id {
                    TrainId::TrainSchedule(train_id) => train_schedule_ids.push(*train_id),
                    TrainId::PacedTrainOccurrence(paced_train_occurrence) => {
                        paced_train_occurrence_ids.push(paced_train_occurrence.clone())
                    }
                }
            } else {
                let train_id = train_id
                    .parse::<i64>()
                    .map_err(|_| TimetableError::ParseError {
                        train_id: train_id.clone(),
                    })?;
                train_schedule_ids.push(train_id);
            }
        }
        let work_schedule_ids = conflict
            .work_schedule_ids
            .into_iter()
            .map(|id| {
                id.parse::<i64>().map_err(|_| TimetableError::ParseError {
                    train_id: id.clone(),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self {
            train_schedule_ids,
            paced_train_occurrence_ids,
            work_schedule_ids,
            start_time: conflict.start_time,
            end_time: conflict.end_time,
            conflict_type: conflict.conflict_type,
            requirements: conflict.requirements,
        })
    }
}

/// Retrieve the list of conflict of the timetable (invalid trains are ignored)
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "List of conflict", body = Vec<ConflictResponse>),
    ),
)]
async fn conflicts(
    State(AppState {
        db_pool,
        valkey: valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<Vec<Conflict>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // 1. Retrieve Timetable / Infra / Trains / Simultion
    let timetable_trains =
        TimetableWithTrains::retrieve_or_fail(&mut db_pool.get().await?, timetable_id, || {
            TimetableError::NotFound { timetable_id }
        })
        .await?;

    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        TimetableError::InfraNotFound { infra_id }
    })
    .await?;

    let (trains, _): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(&mut db_pool.get().await?, timetable_trains.train_ids)
            .await?;

    let (paced_trains, _): (Vec<_>, _) =
        PacedTrain::retrieve_batch(&mut db_pool.get().await?, timetable_trains.paced_train_ids)
            .await?;

    let train_simulations = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client.clone(),
        core_client.clone(),
        &trains,
        &infra,
        electrical_profile_set_id,
    )
    .await?;

    let mut paced_trains_ts = vec![];
    for paced_train in paced_trains.clone() {
        let occurrences =
            (paced_train.duration.num_seconds() / paced_train.step.num_seconds()) as usize;
        let step = paced_train.step;
        let mut start_time = paced_train.start_time;

        let mut all_occurrences = Vec::with_capacity(occurrences);

        for _ in 0..occurrences {
            let mut first_occurrence = paced_train.clone().into_first_occurrence();
            first_occurrence.start_time = start_time;
            all_occurrences.push(first_occurrence);
            start_time += step;
        }

        paced_trains_ts.extend(all_occurrences);
    }

    let paced_train_simulations = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client.clone(),
        core_client.clone(),
        &paced_trains_ts,
        &infra,
        electrical_profile_set_id,
    )
    .await?;

    let (conflict_detection_request, map_string_to_id) = build_conflict_core_request(
        infra,
        trains,
        train_simulations,
        paced_trains_ts,
        paced_train_simulations,
    );

    // 3. Call core
    let conflict_detection_response = conflict_detection_request.fetch(&core_client).await?;
    let conflicts = conflict_detection_response.conflicts;
    let conflicts_response: Result<Vec<Conflict>> = conflicts
        .into_iter()
        .map(|conflict| Conflict::into_conflict_response(conflict, map_string_to_id.clone()))
        .collect();
    Ok(Json(conflicts_response?))
}

fn build_conflict_core_request(
    infra: Infra,
    trains: Vec<TrainSchedule>,
    train_simulations: Vec<(SimulationResponse, PathfindingResult)>,
    paced_trains_ts: Vec<TrainSchedule>,
    paced_train_simulations: Vec<(SimulationResponse, PathfindingResult)>,
) -> (ConflictDetectionRequest, HashMap<String, TrainId>) {
    let mut map_string_to_id: HashMap<String, TrainId> = HashMap::new();
    let mut trains_requirements = HashMap::with_capacity(trains.len());

    // Build train schedule train requirements
    for (train, sim) in trains.into_iter().zip(train_simulations) {
        let (sim, _) = sim;
        let final_output = match sim {
            SimulationResponse::Success { final_output, .. } => final_output,
            _ => continue,
        };

        let key = train.id.to_string();
        map_string_to_id.insert(key.clone(), TrainId::TrainSchedule(train.id));
        trains_requirements.insert(
            key,
            TrainRequirements {
                start_time: train.start_time,
                spacing_requirements: final_output.spacing_requirements,
                routing_requirements: final_output.routing_requirements,
            },
        );
    }

    let mut occurrences = HashMap::new();

    // Build paced train requirements
    for (train, (sim, _)) in paced_trains_ts.into_iter().zip(paced_train_simulations) {
        let final_output = match sim {
            SimulationResponse::Success { final_output, .. } => final_output,
            _ => continue,
        };

        let entry = occurrences.entry(train.id).or_insert(0);
        let occurrence_id = *entry;
        let key = format!("{}#{}", train.id, occurrence_id);
        map_string_to_id.insert(
            key.clone(),
            TrainId::PacedTrainOccurrence(PacedTrainOccurrenceId {
                paced_train_id: train.id,
                index: occurrence_id,
            }),
        );

        trains_requirements.insert(
            key,
            TrainRequirements {
                start_time: train.start_time,
                spacing_requirements: final_output.spacing_requirements,
                routing_requirements: final_output.routing_requirements,
            },
        );

        *entry += 1;
    }

    // Build core conflict request
    let conflict_detection_request = ConflictDetectionRequest {
        infra: infra.id,
        expected_version: infra.version,
        trains_requirements,
        work_schedules: None,
    };

    (conflict_detection_request, map_string_to_id)
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use chrono::Duration;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::error::InternalError;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn get_timetable() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let request = app.get(&format!("/timetable/{}/train_schedules", timetable.id));

        let timetable_from_response: ListTrainSchedulesResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(timetable_from_response.results.len(), 0);
    }

    #[rstest]
    async fn get_unexisting_timetable() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/timetable/{}/train_schedules", 0));
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn timetable_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Insert timetable
        let request = app.post("/timetable");

        let created_timetable: TimetableResult =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let retrieved_timetable =
            Timetable::retrieve(&mut pool.get_ok(), created_timetable.timetable_id)
                .await
                .expect("Failed to retrieve timetable")
                .expect("Timetable not found");

        assert_eq!(created_timetable, retrieved_timetable.into());
    }

    #[rstest]
    async fn timetable_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let request = app.delete(format!("/timetable/{}", timetable.id).as_str());

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Timetable::exists(&mut pool.get_ok(), timetable.id)
            .await
            .expect("Failed to check if timetable exists");

        assert!(!exists);
    }

    #[rstest]
    async fn create_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train_1 = simple_paced_train_base();
        let mut paced_train_2 = simple_paced_train_base();
        paced_train_2.paced.duration = Duration::minutes(120).try_into().unwrap();
        paced_train_2.paced.step = Duration::seconds(30).try_into().unwrap();

        let paced_trains = vec![paced_train_1, paced_train_2];

        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&paced_trains);

        let response: Vec<PacedTrainResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(response.len() == 2);

        let settings = PaginationQueryParams {
            page: 1,
            page_size: Some(20),
        }
        .validate(25)
        .expect("Invalid pagination parameters")
        .into_selection_settings()
        .filter(move || PacedTrain::TIMETABLE_ID.eq(timetable.id));

        let list_result = PacedTrain::list_paginated(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch paced trains");
        assert!(list_result.0.len() == 2);
    }

    #[rstest]
    async fn get_timetable_paced_trains() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let paced_train_1 = simple_paced_train_base();
        let mut paced_train_2 = simple_paced_train_base();
        paced_train_2.train_schedule_base.start_time += Duration::minutes(200);
        paced_train_2.paced.duration = Duration::minutes(120).try_into().unwrap();
        paced_train_2.paced.step = Duration::seconds(30).try_into().unwrap();

        let paced_trains = vec![paced_train_1, paced_train_2];

        let changesets = paced_trains
            .into_iter()
            .map(PacedTrainChangeset::from)
            .map(|cs| cs.timetable_id(timetable.id))
            .collect::<Vec<_>>();

        let _paced_trains: Vec<_> = PacedTrain::create_batch(&mut pool.get_ok(), changesets)
            .await
            .expect("Failed to create paced trains");

        let request = app.get(format!("/timetable/{}/paced_trains", timetable.id).as_str());
        let list: ListPacedTrainsResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(list.results.len(), 2);
    }

    #[rstest]
    async fn get_not_found_timetable_paced_trains() {
        let app = TestAppBuilder::default_app();
        let request = app.get(format!("/timetable/{}/paced_trains", 0).as_str());
        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();
        assert_eq!(&response.error_type, "editoast:timetable:NotFound")
    }
}
