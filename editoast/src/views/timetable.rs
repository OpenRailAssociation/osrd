pub mod occupancy_blocks;
pub mod paced_train;
pub mod similar_schedules;
pub mod simulation;
pub mod stdcm;
pub mod train_schedule;

use std::collections::HashMap;
use std::fmt::Display;
use std::str::FromStr;
use std::sync::Arc;

use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::paced_train::PacedTrain;
use editoast_schemas::train_schedule::TrainSchedule;
use itertools::Either;
use itertools::Itertools;
use paced_train::PacedTrainResponse;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::infra::InfraIdQueryParam;
use super::pagination::PaginatedList as _;
use super::pagination::PaginationQueryParams;
use super::pagination::PaginationStats;
use super::path::pathfinding::PathfindingResult;
use crate::AppState;
use crate::core::AsCoreRequest;
use crate::core::conflict_detection::Conflict as CoreConflict;
use crate::core::conflict_detection::ConflictDetectionRequest;
use crate::core::conflict_detection::ConflictRequirement;
use crate::core::conflict_detection::ConflictType;
use crate::core::conflict_detection::TrainRequirements;
use crate::error::Result;
use crate::models;
use crate::models::Infra;
use crate::models::paced_train::PacedTrainChangeset;
use crate::models::prelude::*;
use crate::models::timetable::Timetable;
use crate::models::timetable::TimetableWithTrains;
use crate::models::train_schedule::TrainScheduleChangeset;

use crate::ValkeyClient;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::CoreClient;
use simulation::train_simulation_batch;
use train_schedule::TrainScheduleForm;
use train_schedule::TrainScheduleResponse;

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
    &paced_train,
    &train_schedule,
    &similar_schedules,
}

editoast_common::schemas! {
    Conflict,
    TimetableResult,
    stdcm::schemas(),
    paced_train::schemas(),
    train_schedule::schemas(),
    simulation::schemas(),
    similar_schedules::schemas(),
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "timetable")]
enum TimetableError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { timetable_id: i64 },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    #[editoast_error(status = 500)]
    Database(editoast_models::model::Error),
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
    #[schema(value_type = Vec<TrainScheduleResponse>)]
    results: Vec<TrainScheduleResponse>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<25>),
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = inline(ListTrainSchedulesResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn get_train_schedules(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams<25>>,
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
        .into_selection_settings()
        .filter(move || models::TrainSchedule::TIMETABLE_ID.eq(timetable_id));

    let (train_schedules, stats) = models::TrainSchedule::list_paginated(conn, settings).await?;
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
    request_body = Vec<TrainSchedule>,
    responses(
        (status = 200, description = "The created train schedules", body = Vec<TrainScheduleResponse>)
    )
)]
async fn post_train_schedule(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(train_schedules): Json<Vec<TrainSchedule>>,
) -> Result<Json<Vec<TrainScheduleResponse>>> {
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
    let train_schedule: Vec<_> = models::TrainSchedule::create_batch(conn, changesets).await?;
    Ok(Json(train_schedule.into_iter().map_into().collect()))
}

/// Create paced trains by batch
#[utoipa::path(
    post, path = "",
    tag = "timetable,paced_train",
    params(TimetableIdParam),
    request_body = Vec<PacedTrain>,
    responses(
        (status = 200, description = "The created paced trains", body = Vec<PacedTrainResponse>)
    )
)]
async fn post_paced_train(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(paced_trains): Json<Vec<PacedTrain>>,
) -> Result<Json<Vec<PacedTrainResponse>>> {
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
    let paced_trains: Vec<_> = models::PacedTrain::create_batch(conn, changesets).await?;
    Ok(Json(paced_trains.into_iter().map_into().collect()))
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(Deserialize))]
struct ListPacedTrainsResponse {
    #[schema(value_type = Vec<PacedTrainResponse>)]
    results: Vec<PacedTrainResponse>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated paced trains
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<25>),
    responses(
        (status = 200, description = "Timetable with paced train ids", body = inline(ListPacedTrainsResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn get_paced_trains(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams<25>>,
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
        .into_selection_settings()
        .filter(move || models::PacedTrain::TIMETABLE_ID.eq(timetable_id));

    let (paced_trains, stats) = models::PacedTrain::list_paginated(conn, settings).await?;

    let results = paced_trains.into_iter().map_into().collect();

    Ok(Json(ListPacedTrainsResponse { stats, results }))
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
    paced_train_occurrence_ids: Vec<PacedTrainOccurrenceId>,
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
    /// This function processes train ids from Core Response
    ///  and maps them to either a `train_schedule_id` or a `paced_train_occurrence_id` based on the provided key mapping.
    fn from_core_response(conflict: CoreConflict) -> Result<Self> {
        let (train_schedule_ids, paced_train_occurrence_ids): (Vec<_>, Vec<_>) = conflict
            .train_ids
            .iter()
            .partition_map(|train_id| match train_id.parse() {
                Ok(TrainId::TrainSchedule(id)) => Either::Left(id),
                Ok(TrainId::PacedTrainOccurrence {
                    paced_train_id,
                    index,
                }) => Either::Right(PacedTrainOccurrenceId {
                    paced_train_id,
                    index,
                }),
                Err(_) => unreachable!("Unreachable case encountered while partitioning train IDs"),
            });

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

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
struct PacedTrainOccurrenceId {
    paced_train_id: i64,
    index: u64,
}

#[derive(Debug, Clone)]
enum TrainId {
    TrainSchedule(i64),
    PacedTrainOccurrence { paced_train_id: i64, index: u64 },
}

impl Display for TrainId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TrainSchedule(id) => write!(f, "{id}"),
            Self::PacedTrainOccurrence {
                paced_train_id,
                index,
            } => write!(f, "{paced_train_id}#{index}"),
        }
    }
}

impl FromStr for TrainId {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.contains('#') {
            let parts: Vec<&str> = s.split('#').collect();
            if parts.len() != 2 {
                return Err("Invalid PacedTrainOccurrenceId format");
            }

            let paced_train_id = parts[0].parse::<i64>().map_err(|_| "Invalid train id")?;
            let index = parts[1]
                .parse::<u64>()
                .map_err(|_| "Invalid occurence id")?;
            Ok(TrainId::PacedTrainOccurrence {
                paced_train_id,
                index,
            })
        } else {
            let id = s.parse::<i64>().map_err(|_| "Invalid train id")?;
            Ok(TrainId::TrainSchedule(id))
        }
    }
}

/// Retrieve the list of conflict of the timetable (invalid trains are ignored)
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "List of conflict", body = Vec<Conflict>),
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

    let mut conn = db_pool.get().await?;

    #[expect(deprecated)]
    let infra = Infra::retrieve_or_fail(&mut conn, infra_id, || TimetableError::InfraNotFound {
        infra_id,
    })
    .await?;

    let (trains, paced_trains) = retrieve_trains_and_paced_trains(conn, timetable_id).await?;

    let (train_simulations, paced_train_simulations) = retrieve_simulations(
        &mut db_pool.get().await?,
        valkey_client,
        core_client.clone(),
        &trains,
        &paced_trains,
        &infra,
        electrical_profile_set_id,
    )
    .await?;

    let conflict_detection_request = build_conflict_core_request(
        infra,
        &trains,
        train_simulations,
        &paced_trains,
        paced_train_simulations,
    );

    // 3. Call core
    let conflict_detection_response = conflict_detection_request.fetch(&core_client).await?;
    let conflicts = conflict_detection_response.conflicts;
    let conflicts_response: Result<Vec<Conflict>> = conflicts
        .into_iter()
        .map(Conflict::from_core_response)
        .collect();
    Ok(Json(conflicts_response?))
}

async fn retrieve_trains_and_paced_trains(
    mut conn: DbConnection,
    timetable_id: i64,
) -> Result<(Vec<models::TrainSchedule>, Vec<models::PacedTrain>)> {
    let timetable_trains =
        TimetableWithTrains::retrieve_or_fail(conn.clone(), timetable_id, || {
            TimetableError::NotFound { timetable_id }
        })
        .await?;
    let mut conn_clone = conn.clone();
    let (trains, paced_trains): (Vec<_>, Vec<_>) = tokio::try_join!(
        models::TrainSchedule::retrieve_batch_unchecked(&mut conn, timetable_trains.train_ids),
        models::PacedTrain::retrieve_batch_unchecked(
            &mut conn_clone,
            timetable_trains.paced_train_ids
        )
    )?;

    Ok((trains, paced_trains))
}

async fn retrieve_simulations(
    conn: &mut DbConnection,
    valkey_client: Arc<ValkeyClient>,
    core_client: Arc<CoreClient>,
    trains: &[models::TrainSchedule],
    paced_trains: &[models::PacedTrain],
    infra: &Infra,
    electrical_profile_set_id: Option<i64>,
) -> Result<(
    Vec<(simulation::Response, PathfindingResult)>,
    Vec<(simulation::Response, PathfindingResult)>,
)> {
    let paced_train_to_ts = paced_trains
        .iter()
        .flat_map(|pt| pt.iter_occurrences())
        .collect::<Vec<_>>();
    let mut conn_clone = conn.clone();
    let (train_simulations, paced_train_simulations) = tokio::try_join!(
        train_simulation_batch(
            conn,
            valkey_client.clone(),
            core_client.clone(),
            trains,
            infra,
            electrical_profile_set_id,
        ),
        train_simulation_batch(
            &mut conn_clone,
            valkey_client.clone(),
            core_client.clone(),
            &paced_train_to_ts,
            infra,
            electrical_profile_set_id,
        )
    )?;

    Ok((train_simulations, paced_train_simulations))
}

fn build_conflict_core_request(
    infra: Infra,
    trains: &[models::TrainSchedule],
    train_simulations: Vec<(simulation::Response, PathfindingResult)>,
    paced_trains: &[models::PacedTrain],
    paced_train_simulations: Vec<(simulation::Response, PathfindingResult)>,
) -> ConflictDetectionRequest {
    let mut trains_requirements = HashMap::new();

    // Build train schedule train requirements
    for (train, sim) in trains.iter().zip(train_simulations) {
        let (sim, _) = sim;
        let final_output = match sim {
            simulation::Response::Success { final_output, .. } => final_output,
            _ => continue,
        };
        let key = TrainId::TrainSchedule(train.id).to_string();
        trains_requirements.insert(
            key,
            TrainRequirements {
                start_time: train.start_time,
                spacing_requirements: final_output.spacing_requirements,
                routing_requirements: final_output.routing_requirements,
            },
        );
    }

    // Build paced train requirements
    let mut it = paced_train_simulations.into_iter();
    for paced_train in paced_trains {
        let occurrences = &paced_train.num_occurrences();
        let simulations: Vec<_> = it.by_ref().take(*occurrences).collect();

        if simulations.len() < *occurrences {
            panic!(
                "At least one simulation is missing for paced train {}",
                paced_train.id
            );
        }

        for (index, (sim, _)) in simulations.into_iter().enumerate() {
            let final_output = match sim {
                simulation::Response::Success { final_output, .. } => final_output,
                _ => continue,
            };

            let key = TrainId::PacedTrainOccurrence {
                paced_train_id: paced_train.id,
                index: index as u64,
            }
            .to_string();
            trains_requirements.insert(
                key,
                TrainRequirements {
                    start_time: paced_train.start_time,
                    spacing_requirements: final_output.spacing_requirements,
                    routing_requirements: final_output.routing_requirements,
                },
            );
        }
    }

    // Build core conflict request
    ConflictDetectionRequest {
        infra: infra.id,
        expected_version: infra.version,
        trains_requirements,
        work_schedules: None,
    }
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use chrono::Duration;
    use editoast_schemas::paced_train::ExceptionType;
    use editoast_schemas::paced_train::PacedTrainException;
    use editoast_schemas::paced_train::PathAndScheduleChangeGroup;
    use editoast_schemas::train_schedule::MarginValue;
    use editoast_schemas::train_schedule::Margins;
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

        #[expect(deprecated)]
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
    async fn create_paced_train_exceptions() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let mut paced_train_1 = simple_paced_train_base();
        let exception_1 = PacedTrainException {
            key: "exception_key_1".into(),
            exception_type: ExceptionType::Created {},
            disabled: false,
            constraint_distribution: None,
            initial_speed: None,
            labels: None,
            options: None,
            path_and_schedule: None,
            rolling_stock: None,
            rolling_stock_category: None,
            speed_limit_tag: None,
            start_time: None,
            train_name: None,
        };

        let exception_2 = PacedTrainException {
            key: "exception_key_2".into(),
            exception_type: ExceptionType::Modified {
                occurrence_index: 1,
            },
            disabled: true,
            path_and_schedule: Some(PathAndScheduleChangeGroup {
                power_restrictions: vec![],
                schedule: vec![],
                path: vec![],
                margins: Margins {
                    boundaries: vec![],
                    values: vec![MarginValue::Percentage(5.0)],
                },
            }),
            constraint_distribution: None,
            initial_speed: None,
            labels: None,
            options: None,
            rolling_stock: None,
            rolling_stock_category: None,
            speed_limit_tag: None,
            start_time: None,
            train_name: None,
        };

        paced_train_1.exceptions = vec![exception_1.clone(), exception_2.clone()];

        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&vec![paced_train_1.clone()]);

        let _: Vec<PacedTrainResponse> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let settings = SelectionSettings::default()
            .filter(move || models::PacedTrain::TIMETABLE_ID.eq(timetable.id))
            .limit(25)
            .offset(0);

        let list_result = models::PacedTrain::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch paced trains");

        assert_eq!(&list_result[0].exceptions[0], &exception_1);
        assert_eq!(&list_result[0].exceptions[1], &exception_2);
    }

    #[rstest]
    async fn create_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train_1 = simple_paced_train_base();
        let mut paced_train_2 = simple_paced_train_base();
        paced_train_2.paced.time_window = Duration::minutes(120).try_into().unwrap();
        paced_train_2.paced.interval = Duration::seconds(30).try_into().unwrap();

        let paced_trains = vec![paced_train_1, paced_train_2.clone()];

        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&paced_trains);

        let response: Vec<PacedTrainResponse> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(response.len() == 2);

        let settings = SelectionSettings::default()
            .filter(move || models::PacedTrain::TIMETABLE_ID.eq(timetable.id))
            .limit(25)
            .offset(0);

        let list_result = models::PacedTrain::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch paced trains");

        assert!(list_result.len() == 2);
        assert_eq!(list_result[0].exceptions, paced_train_2.exceptions);
    }

    #[rstest]
    async fn get_timetable_paced_trains() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let paced_train_1 = simple_paced_train_base();
        let mut paced_train_2 = simple_paced_train_base();
        paced_train_2.train_schedule_base.start_time += Duration::minutes(200);
        paced_train_2.paced.time_window = Duration::minutes(120).try_into().unwrap();
        paced_train_2.paced.interval = Duration::seconds(30).try_into().unwrap();

        let paced_trains = vec![paced_train_1, paced_train_2];

        let changesets = paced_trains
            .into_iter()
            .map(PacedTrainChangeset::from)
            .map(|cs| cs.timetable_id(timetable.id))
            .collect::<Vec<_>>();

        let _paced_trains: Vec<_> =
            models::PacedTrain::create_batch(&mut pool.get_ok(), changesets)
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
