mod occupancy_blocks;
pub mod paced_train;
pub(in crate::views) mod similar_trains;
pub mod simulation;
pub mod stdcm;
mod track_occupancy;
pub mod train_schedule;

use std::sync::Arc;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::DateTime;
use chrono::Utc;
use common::units::quantities::Acceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Velocity;
use core_client::AsCoreRequest;
use core_client::conflict_detection::Conflict as CoreConflict;
use core_client::conflict_detection::ConflictDetectionRequest;
use core_client::conflict_detection::ConflictRequirement;
use core_client::conflict_detection::ConflictType;
use core_client::conflict_detection::TrainRequirements;
use core_client::conflict_detection::TrainRequirementsById;
use core_client::simulation::CompleteReportTrain;
use core_client::simulation::PhysicsConsist;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use itertools::Either;
use itertools::Itertools;
use itertools::izip;
use paced_train::PacedTrainResponse;
use schemas::paced_train::PacedTrain;
use schemas::rolling_stock::EtcsBrakeParams;
use schemas::rolling_stock::RollingResistance;
use schemas::rolling_stock::RollingStock;
use schemas::rolling_stock::TowedRollingStock;
use schemas::train_schedule::TrainSchedule;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use simulation::train_simulation_batch;
use thiserror::Error;
use train_schedule::TrainScheduleForm;
use train_schedule::TrainScheduleResponse;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::infra::InfraIdQueryParam;
use super::pagination::ConcatenatedPaginatedList;
use super::pagination::PaginatedList;
use super::pagination::PaginationQueryParams;
use super::pagination::PaginationStats;
use super::path::pathfinding::PathfindingResult;
use crate::AppState;
use crate::error::Result;
use crate::models;
use crate::models::Infra;
use crate::models::paced_train::OccurrenceId;
use crate::models::paced_train::PacedTrainChangeset;
use crate::models::paced_train::TrainId;
use crate::models::timetable::Timetable;
use crate::models::timetable::TimetableWithTrains;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use editoast_models::prelude::*;

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
    Database(editoast_models::Error),
    #[error("Failed to parse train_id '{train_id}'")]
    #[editoast_error(status = 500)]
    ParseError { train_id: String },
}

/// Creation result for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
pub(in crate::views) struct TimetableResult {
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
pub struct TimetableIdParam {
    /// A timetable ID
    pub id: i64,
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct ListTrainSchedulesResponse {
    #[schema(value_type = Vec<TrainScheduleResponse>)]
    results: Vec<TrainScheduleResponse>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated schedules
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<200>),
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = inline(ListTrainSchedulesResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
pub(in crate::views) async fn get_train_schedules(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams<200>>,
) -> Result<Json<ListTrainSchedulesResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
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
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "timetable",
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
pub(in crate::views) async fn post(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<TimetableResult>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
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
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "timetable",
    params(TimetableIdParam),
    responses(
        (status = 204, description = "No content"),
        (status = 404, description = "Timetable not found"),
    ),
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
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
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tags = ["timetable", "train_schedule"],
    params(TimetableIdParam),
    request_body = Vec<TrainSchedule>,
    responses(
        (status = 200, description = "The created train schedules", body = Vec<TrainScheduleResponse>)
    )
)]
pub(in crate::views) async fn post_train_schedule(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(train_schedules): Json<Vec<TrainSchedule>>,
) -> Result<Json<Vec<TrainScheduleResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
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
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tags = ["timetable", "paced_train"],
    params(TimetableIdParam),
    request_body = Vec<PacedTrain>,
    responses(
        (status = 200, description = "The created paced trains", body = Vec<PacedTrainResponse>)
    )
)]
pub(in crate::views) async fn post_paced_train(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(paced_trains): Json<Vec<PacedTrain>>,
) -> Result<Json<Vec<PacedTrainResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
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
pub(in crate::views) struct ListPacedTrainsResponse {
    #[schema(value_type = Vec<PacedTrainResponse>)]
    results: Vec<PacedTrainResponse>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated paced trains
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<200>),
    responses(
        (status = 200, description = "Timetable with paced train ids", body = inline(ListPacedTrainsResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
pub(in crate::views) async fn get_paced_trains(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams<200>>,
) -> Result<Json<ListPacedTrainsResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
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
                Ok(TrainId::PacedTrain {
                    paced_train_id,
                    occurrence_id: OccurrenceId::BaseOccurrence { index },
                }) => Either::Right(PacedTrainOccurrenceId {
                    paced_train_id,
                    occurrence_ref: PacedTrainOccurrenceRef::BaseOccurrence { index },
                }),
                Ok(TrainId::PacedTrain {
                    paced_train_id,
                    occurrence_id: OccurrenceId::CreatedException { exception_key },
                }) => Either::Right(PacedTrainOccurrenceId {
                    paced_train_id,
                    occurrence_ref: PacedTrainOccurrenceRef::CreatedException { exception_key },
                }),
                Ok(TrainId::PacedTrain {
                    paced_train_id,
                    occurrence_id:
                        OccurrenceId::ModifiedException {
                            exception_key,
                            index,
                        },
                }) => Either::Right(PacedTrainOccurrenceId {
                    paced_train_id,
                    occurrence_ref: PacedTrainOccurrenceRef::ModifiedException {
                        index,
                        exception_key,
                    },
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
    #[schema(inline)]
    #[serde(flatten)]
    occurrence_ref: PacedTrainOccurrenceRef,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(untagged)]
enum PacedTrainOccurrenceRef {
    BaseOccurrence { index: u64 },
    ModifiedException { index: u64, exception_key: String },
    CreatedException { exception_key: String },
}

/// Retrieve the list of conflicts of the timetable (invalid trains are ignored)
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "List of conflicts", body = Vec<Conflict>),
    ),
)]
pub(in crate::views) async fn conflicts(
    State(AppState {
        config,
        db_pool,
        valkey_client,
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
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || TimetableError::InfraNotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let (trains, paced_trains) = retrieve_trains_and_paced_trains(conn, timetable_id).await?;

    // Flatten paced trains occurrences
    let (paced_train_ids, occurrence_trains): (Vec<_>, Vec<_>) = paced_trains
        .iter()
        .flat_map(|pt| {
            pt.iter_occurrences()
                .map(|(occurrence_id, train_schedule)| {
                    (
                        TrainId::PacedTrain {
                            paced_train_id: pt.id,
                            occurrence_id,
                        },
                        train_schedule,
                    )
                })
        })
        .unzip();
    let occurrence_simulations: Vec<_> = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client.clone(),
        core_client.clone(),
        &occurrence_trains,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .into_iter()
    .map(|(sim, _)| sim)
    .collect();
    let simulations: Vec<_> = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client.clone(),
        core_client.clone(),
        &trains,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .into_iter()
    .map(|(sim, _)| sim)
    .collect();

    // Concatenate paced trains occurrences with train schedules
    let train_ids: Vec<_> = paced_train_ids
        .into_iter()
        .chain(trains.iter().map(|ts| TrainId::TrainSchedule(ts.id)))
        .collect();
    let start_times = occurrence_trains
        .iter()
        .map(|ts| ts.start_time())
        .chain(trains.iter().map(|ts| ts.start_time()))
        .collect::<Vec<_>>();
    let simulations: Vec<_> = occurrence_simulations
        .into_iter()
        .chain(simulations)
        .collect();

    let conflict_detection_request =
        build_conflict_core_request(infra, start_times, train_ids, simulations);

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

/// Build the core conflict detection request
///
/// **Panic** if the number of start_times, train_ids, and simulations do not match.
fn build_conflict_core_request(
    infra: Infra,
    start_times: Vec<DateTime<Utc>>,
    train_ids: Vec<TrainId>,
    simulations: Vec<Arc<simulation::Response>>,
) -> ConflictDetectionRequest {
    assert_eq!(start_times.len(), simulations.len());
    assert_eq!(train_ids.len(), simulations.len());

    let trains_requirements = izip!(start_times, train_ids, simulations)
        .flat_map(|(start_time, train_id, sim)| {
            let CompleteReportTrain {
                spacing_requirements,
                routing_requirements,
                ..
            } = match Arc::unwrap_or_clone(sim) {
                simulation::Response::Success(SimulationResponseSuccess {
                    final_output, ..
                }) => Some(final_output),
                _ => None,
            }?;
            Some((
                train_id.to_string(),
                TrainRequirements {
                    start_time,
                    spacing_requirements,
                    routing_requirements,
                },
            ))
        })
        .collect();

    ConflictDetectionRequest {
        infra: infra.id,
        expected_version: infra.version,
        trains_requirements,
        work_schedules: None,
    }
}

/// Retrieve the list of requirements of the timetable (invalid trains are ignored)
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<200>, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "The paginated list of timetable requirements", body = inline(TrainRequirementsPage)),
    ),
)]
pub(in crate::views) async fn requirements(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(page_settings): Query<PaginationQueryParams<200>>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<TrainRequirementsPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || TimetableError::InfraNotFound {
        infra_id,
    })
    .await?;
    Timetable::exists_or_fail(conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;

    // List trains and paced trains
    let (trains, stats) = <(models::TrainSchedule, models::PacedTrain)>::list_concatenated(
        conn,
        (
            page_settings
                .into_selection_settings()
                .filter(move || models::TrainSchedule::TIMETABLE_ID.eq(timetable_id))
                .order_by(move || models::TrainSchedule::ID.asc()),
            page_settings
                .into_selection_settings()
                .filter(move || models::PacedTrain::TIMETABLE_ID.eq(timetable_id))
                .order_by(move || models::PacedTrain::ID.asc()),
        ),
    )
    .await?;
    let (train_ids, trains): (Vec<_>, Vec<_>) = trains
        .flat_map(|train| match train {
            Either::Left(ts) => vec![(TrainId::TrainSchedule(ts.id), ts.into())],
            Either::Right(pt) => pt
                .iter_occurrences()
                .map(|(occurrence_id, train_schedule)| {
                    (
                        TrainId::PacedTrain {
                            paced_train_id: pt.id,
                            occurrence_id,
                        },
                        train_schedule,
                    )
                })
                .collect(),
        })
        .unzip();

    let simulations = train_simulation_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        &trains,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .into_iter()
    .map(|(sim, _)| Arc::unwrap_or_clone(sim));
    let start_times = trains.iter().map(|ts| ts.start_time());
    let results =
        build_trains_requirements(train_ids.into_iter(), start_times, simulations).collect();

    Ok(Json(TrainRequirementsPage { results, stats }))
}

fn build_trains_requirements(
    train_ids: impl Iterator<Item = TrainId>,
    start_times: impl Iterator<Item = DateTime<Utc>>,
    simulations: impl Iterator<Item = simulation::Response>,
) -> impl Iterator<Item = TrainRequirementsById> {
    izip!(train_ids, start_times, simulations).filter_map(|(train_id, start_time, sim)| {
        let CompleteReportTrain {
            spacing_requirements,
            routing_requirements,
            ..
        } = match sim {
            simulation::Response::Success(SimulationResponseSuccess { final_output, .. }) => {
                Some(final_output)
            }
            _ => None,
        }?;
        Some(TrainRequirementsById {
            train_id: train_id.to_string(),
            start_time,
            spacing_requirements,
            routing_requirements,
        })
    })
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct TrainRequirementsPage {
    #[schema(value_type = Vec<TrainRequirementsById>)]
    results: Vec<TrainRequirementsById>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[derive(Debug, Clone)]
pub struct PhysicsConsistParameters {
    pub total_mass: Option<Mass>,
    pub total_length: Option<Length>,
    pub max_speed: Option<Velocity>,
    pub towed_rolling_stock: Option<TowedRollingStock>,
    pub traction_engine: RollingStock,
}

impl PhysicsConsistParameters {
    pub fn from_traction_engine(traction_engine: RollingStock) -> Self {
        PhysicsConsistParameters {
            max_speed: None,
            total_length: None,
            total_mass: None,
            towed_rolling_stock: None,
            traction_engine,
        }
    }

    pub fn compute_length(&self) -> Length {
        let towed_rolling_stock_length = self
            .towed_rolling_stock
            .as_ref()
            .map(|trs| trs.length)
            .unwrap_or_default();

        self.total_length
            .unwrap_or(self.traction_engine.length + towed_rolling_stock_length)
    }

    pub fn compute_max_speed(&self) -> Velocity {
        let max_speeds = [
            self.max_speed,
            self.towed_rolling_stock
                .as_ref()
                .and_then(|towed| towed.max_speed),
            Some(self.traction_engine.max_speed),
        ];
        max_speeds
            .into_iter()
            .flatten()
            .reduce(Velocity::min)
            .unwrap_or(self.traction_engine.max_speed)
    }

    pub fn compute_startup_acceleration(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed_rolling_stock| {
                self.traction_engine
                    .startup_acceleration
                    .max(towed_rolling_stock.startup_acceleration)
            })
            .unwrap_or(self.traction_engine.startup_acceleration)
    }

    pub fn compute_comfort_acceleration(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed_rolling_stock| {
                self.traction_engine
                    .comfort_acceleration
                    .min(towed_rolling_stock.comfort_acceleration)
            })
            .unwrap_or(self.traction_engine.comfort_acceleration)
    }

    pub fn compute_inertia_coefficient(&self) -> f64 {
        if let (Some(towed_rolling_stock), Some(total_mass)) =
            (self.towed_rolling_stock.as_ref(), self.total_mass)
        {
            let towed_mass = total_mass - self.traction_engine.mass;
            let traction_engine_inertia =
                self.traction_engine.mass * self.traction_engine.inertia_coefficient;
            let towed_inertia = towed_mass * towed_rolling_stock.inertia_coefficient;
            ((traction_engine_inertia + towed_inertia) / total_mass).into()
        } else {
            self.traction_engine.inertia_coefficient
        }
    }

    pub fn compute_mass(&self) -> Mass {
        let traction_engine_mass = self.traction_engine.mass;
        let towed_rolling_stock_mass = self
            .towed_rolling_stock
            .as_ref()
            .map(|trs| trs.mass)
            .unwrap_or_default();
        self.total_mass
            .unwrap_or(traction_engine_mass + towed_rolling_stock_mass)
    }

    pub fn compute_rolling_resistance(&self) -> RollingResistance {
        if let (Some(towed_rolling_stock), Some(total_mass)) =
            (self.towed_rolling_stock.as_ref(), self.total_mass)
        {
            let traction_engine_rr = &self.traction_engine.rolling_resistance;
            let towed_rs_rr = &towed_rolling_stock.rolling_resistance;
            let traction_engine_mass = self.traction_engine.mass; // kg

            let towed_mass = total_mass - traction_engine_mass; // kg

            let traction_engine_solid_friction_a = traction_engine_rr.A; // N
            let traction_engine_viscosity_friction_b = traction_engine_rr.B; // N/(m/s)
            let traction_engine_aerodynamic_drag_c = traction_engine_rr.C; // N/(m/s)²

            let towed_solid_friction_a = towed_rs_rr.A * towed_mass; // N
            let towed_viscosity_friction_b = towed_rs_rr.B * towed_mass; // N/(m/s)
            let towed_aerodynamic_drag_c = towed_rs_rr.C * towed_mass; // N/(m/s)²

            let solid_friction_a = traction_engine_solid_friction_a + towed_solid_friction_a; // N
            let viscosity_friction_b =
                traction_engine_viscosity_friction_b + towed_viscosity_friction_b; // N/(m/s)
            let aerodynamic_drag_c = traction_engine_aerodynamic_drag_c + towed_aerodynamic_drag_c; // N/(m/s)²

            RollingResistance {
                rolling_resistance_type: traction_engine_rr.rolling_resistance_type.clone(),
                A: solid_friction_a,
                B: viscosity_friction_b,
                C: aerodynamic_drag_c,
            }
        } else {
            self.traction_engine.rolling_resistance.clone()
        }
    }

    pub fn compute_const_gamma(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed| Acceleration::min(towed.const_gamma, self.traction_engine.const_gamma))
            .unwrap_or_else(|| self.traction_engine.const_gamma)
    }

    pub fn compute_etcs_brake_params(&self) -> Option<EtcsBrakeParams> {
        // TODO: handle towed rolling-stock when applying ERTMS to that case
        assert!(
            !self
                .traction_engine
                .supported_signaling_systems
                .0
                .contains(&"ETCS_LEVEL2".to_string())
                || self.towed_rolling_stock.is_none(),
            "ETCS is not handled (yet) for towed rolling-stock"
        );

        self.traction_engine.etcs_brake_params.clone()
    }
}

impl From<PhysicsConsistParameters> for PhysicsConsist {
    fn from(params: PhysicsConsistParameters) -> Self {
        let length = params.compute_length();
        let max_speed = params.compute_max_speed();
        let startup_acceleration = params.compute_startup_acceleration();
        let comfort_acceleration = params.compute_comfort_acceleration();
        let inertia_coefficient = params.compute_inertia_coefficient();
        let mass = params.compute_mass();
        let rolling_resistance = params.compute_rolling_resistance();
        let const_gamma = params.compute_const_gamma();
        let etcs_brake_params = params.compute_etcs_brake_params();

        let traction_engine = params.traction_engine;

        Self {
            effort_curves: traction_engine.effort_curves,
            base_power_class: traction_engine.base_power_class,
            length,
            mass,
            max_speed,
            startup_time: traction_engine.startup_time,
            startup_acceleration,
            comfort_acceleration,
            const_gamma,
            etcs_brake_params,
            inertia_coefficient,
            rolling_resistance,
            power_restrictions: traction_engine.power_restrictions.into_iter().collect(),
            electrical_power_startup_time: traction_engine.electrical_power_startup_time,
            raise_pantograph_time: traction_engine.raise_pantograph_time,
        }
    }
}

#[cfg(test)]
pub(in crate::views) fn simulation_empty_response() -> core_client::simulation::Response {
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ElectricalProfiles;
    use core_client::simulation::ReportTrain;
    use core_client::simulation::SimulationSuccess;
    use core_client::simulation::SpeedLimitProperties;

    core_client::simulation::Response::Success(SimulationSuccess {
        base: ReportTrain {
            positions: vec![],
            times: vec![0],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1],
        },
        provisional: ReportTrain {
            positions: vec![],
            times: vec![0],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1],
        },
        final_output: CompleteReportTrain {
            report_train: ReportTrain {
                positions: vec![0],
                times: vec![0],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 1],
            },
            signal_critical_positions: vec![],
            zone_updates: vec![],
            spacing_requirements: vec![],
            routing_requirements: vec![],
        },
        mrsp: SpeedLimitProperties {
            boundaries: vec![],
            values: vec![],
        },
        electrical_profiles: ElectricalProfiles {
            boundaries: vec![],
            values: vec![],
        },
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use chrono::Duration;
    use chrono::NaiveDate;
    use common::units;
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ElectricalProfiles;
    use core_client::simulation::ReportTrain;
    use core_client::simulation::RoutingRequirement;
    use core_client::simulation::RoutingZoneRequirement;
    use core_client::simulation::SpacingRequirement;
    use core_client::simulation::SpeedLimitProperties;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::fixtures::simple_created_exception_with_change_groups;
    use schemas::fixtures::simple_modified_exception_with_change_groups;
    use schemas::fixtures::simple_rolling_stock;
    use schemas::fixtures::towed_rolling_stock;
    use schemas::paced_train::ExceptionType;
    use schemas::paced_train::PacedTrainException;
    use schemas::paced_train::PathAndScheduleChangeGroup;
    use schemas::rolling_stock::RollingResistance;
    use schemas::train_schedule::MarginValue;
    use schemas::train_schedule::Margins;

    use super::*;
    use crate::error::InternalError;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::views::test_app::TestAppBuilder;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_timetable() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let request = app.get(&format!("/timetable/{}/train_schedules", timetable.id));

        let timetable_from_response: ListTrainSchedulesResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(timetable_from_response.results.len(), 0);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_timetable() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/timetable/{}/train_schedules", 0));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Insert timetable
        let request = app.post("/timetable");

        let created_timetable: TimetableResult = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let retrieved_timetable =
            Timetable::retrieve(pool.get_ok(), created_timetable.timetable_id)
                .await
                .expect("Failed to retrieve timetable")
                .expect("Timetable not found");

        assert_eq!(created_timetable, retrieved_timetable.into());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let request = app.delete(format!("/timetable/{}", timetable.id).as_str());

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = Timetable::exists(&mut pool.get_ok(), timetable.id)
            .await
            .expect("Failed to check if timetable exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        let _: Vec<PacedTrainResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_paced_train_with_duplicated_exceptions() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let mut paced_train_1 = simple_paced_train_base();

        paced_train_1.exceptions = vec![
            simple_created_exception_with_change_groups("duplicated_key_1"),
            simple_modified_exception_with_change_groups("duplicated_key_1", 0),
        ];

        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&vec![paced_train_1.clone()]);

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY)
            .bytes();
        assert_eq!(
            &String::from_utf8(response).unwrap(),
            "Failed to deserialize the JSON body into the target type: [0]: Duplicate exception key: 'duplicated_key_1' at line 1 column 2452"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        let response: Vec<PacedTrainResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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
        let list: ListPacedTrainsResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(list.results.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_not_found_timetable_paced_trains() {
        let app = TestAppBuilder::default_app();
        let request = app.get(format!("/timetable/{}/paced_trains", 0).as_str());
        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();
        assert_eq!(&response.error_type, "editoast:timetable:NotFound")
    }

    // Build one train schedule and one paced train with 2 occurrences
    // then check that the function 'build_conflict_core_request'
    // produce something coherent
    #[test]
    fn build_coherent_conflict_core_request() {
        // Given
        let infra = Infra::default();
        let ts_id = 13;
        let ts_start_time = NaiveDate::from_ymd_opt(2025, 1, 1)
            .unwrap()
            .and_hms_opt(8, 0, 0)
            .unwrap()
            .and_utc();

        let spacing_requirement = SpacingRequirement {
            zone: "ZONE_1".to_string(),
            begin_time: 0,
            end_time: 7,
        };
        let routing_requirement = RoutingRequirement {
            route: "ZONE_2".to_string(),
            begin_time: 12,
            zones: vec![RoutingZoneRequirement {
                zone: "ZONE_3".to_string(),
                entry_detector: "D_1".to_string(),
                exit_detector: "D_2".to_string(),
                switches: {
                    let mut map = HashMap::new();
                    map.insert("S_1".to_string(), "S_2".to_string());
                    map
                },
                end_time: 15,
            }],
        };
        let paced_train_id = 42;
        let paced_start_time = NaiveDate::from_ymd_opt(2025, 1, 1)
            .unwrap()
            .and_hms_opt(9, 0, 0)
            .unwrap()
            .and_utc();
        let paced_interval = chrono::Duration::try_hours(1).unwrap();

        // Start times
        let start_times = vec![
            paced_start_time,
            paced_start_time + paced_interval,
            ts_start_time,
        ];
        // Train IDs
        let train_ids = vec![
            TrainId::PacedTrain {
                paced_train_id,
                occurrence_id: OccurrenceId::BaseOccurrence { index: 0 },
            },
            TrainId::PacedTrain {
                paced_train_id,
                occurrence_id: OccurrenceId::BaseOccurrence { index: 1 },
            },
            TrainId::TrainSchedule(ts_id),
        ];

        // Simulations
        let paced_train_sim = Arc::new(simulation::Response::Success(SimulationResponseSuccess {
            base: ReportTrain::default(),
            provisional: ReportTrain::default(),
            final_output: CompleteReportTrain {
                spacing_requirements: vec![spacing_requirement.clone()],
                routing_requirements: vec![routing_requirement.clone()],
                ..Default::default()
            },
            mrsp: SpeedLimitProperties::default(),
            electrical_profiles: ElectricalProfiles::default(),
        }));
        let mut simulations = vec![paced_train_sim; 2];
        simulations.push(Arc::new(simulation::Response::Success(
            SimulationResponseSuccess {
                base: ReportTrain::default(),
                provisional: ReportTrain::default(),
                final_output: CompleteReportTrain {
                    spacing_requirements: vec![spacing_requirement.clone()],
                    routing_requirements: vec![routing_requirement.clone()],
                    ..Default::default()
                },
                mrsp: SpeedLimitProperties::default(),
                electrical_profiles: ElectricalProfiles::default(),
            },
        )));

        // When
        let conflict_core_request =
            build_conflict_core_request(infra, start_times, train_ids, simulations);

        // Then (assert the train schedule)
        assert_eq!(conflict_core_request.trains_requirements.len(), 3);
        let simple_requirements = conflict_core_request
            .trains_requirements
            .get(&format!("{ts_id}"))
            .unwrap();
        assert_eq!(simple_requirements.start_time, ts_start_time);
        assert_eq!(
            simple_requirements.spacing_requirements,
            vec![spacing_requirement.clone()]
        );
        assert_eq!(
            simple_requirements.routing_requirements,
            vec![routing_requirement.clone()]
        );

        // Then (assert the paced train, first occurrence)
        let paced_0_requirements = conflict_core_request
            .trains_requirements
            .get(&format!("{paced_train_id}#0"))
            .unwrap();
        assert_eq!(paced_0_requirements.start_time, paced_start_time);
        assert_eq!(
            paced_0_requirements.spacing_requirements,
            vec![spacing_requirement.clone()]
        );
        assert_eq!(
            paced_0_requirements.routing_requirements,
            vec![routing_requirement.clone()]
        );

        // Then (assert the paced train, second occurrence)
        let paced_1_requirements = conflict_core_request
            .trains_requirements
            .get(&format!("{paced_train_id}#1"))
            .unwrap();
        assert_eq!(
            paced_1_requirements.start_time,
            paced_start_time + paced_interval
        );
        assert_eq!(
            paced_1_requirements.spacing_requirements,
            vec![spacing_requirement]
        );
        assert_eq!(
            paced_1_requirements.routing_requirements,
            vec![routing_requirement]
        );
    }

    #[rstest]
    #[case("42")]
    #[case("42#10")]
    #[case("84@exception_21")]
    #[case("84@exception_21#7")]
    fn train_id_parse_and_to_string_roundtrip(#[case] id: &str) {
        assert_eq!(id.parse::<TrainId>().unwrap().to_string(), id);
    }

    #[rstest]
    #[case("", "Invalid train id")]
    #[case("#", "Invalid train id")]
    #[case("@", "Invalid train id")]
    #[case("@#", "Invalid train id")]
    #[case("22#", "Invalid occurrence index")]
    #[case("22@#", "Invalid exception index")]
    #[case("22@#zero", "Invalid exception index")]
    #[case("zero#", "Invalid train id")]
    #[case("zero@", "Invalid train id")]
    #[case("zero@#", "Invalid train id")]
    #[case("22#zero", "Invalid occurrence index")]
    #[case("22@key#", "Invalid exception index")]
    #[case("22@key#zero", "Invalid exception index")]
    fn train_id_parse_fails(#[case] id: &str, #[case] err: &str) {
        assert_eq!(&id.parse::<TrainId>().unwrap_err().to_string(), err);
    }

    fn create_physics_consist() -> PhysicsConsistParameters {
        PhysicsConsistParameters {
            total_length: Some(units::meter::new(100.0)),
            total_mass: Some(units::kilogram::new(50000.0)),
            max_speed: Some(units::meter_per_second::new(22.0)),
            towed_rolling_stock: Some(towed_rolling_stock()),
            traction_engine: simple_rolling_stock(),
        }
    }

    #[test]
    fn physics_consist_compute_length() {
        let mut physics_consist = create_physics_consist();
        physics_consist.total_length = Some(units::meter::new(100.0));
        physics_consist.traction_engine.length = units::meter::new(40.0);

        // We always take total_length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(100000.)
        );

        physics_consist.total_length = None;
        // When no total_length we take towed length + traction_engine length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(70000.)
        );

        physics_consist.total_length = None;
        physics_consist.towed_rolling_stock = None;
        // When no user specified length and towed rolling stock, we take traction_engine length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(40000.)
        );
    }

    #[test]
    fn physics_consist_compute_mass() {
        let mut physics_consist = create_physics_consist();
        physics_consist.total_mass = Some(units::kilogram::new(50000.0));
        physics_consist.traction_engine.mass = units::kilogram::new(15000.0);

        // We always take total_mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(50000.));

        physics_consist.total_mass = None;
        // When no total_mass we take towed mass + traction_engine mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(65000.));

        physics_consist.total_mass = None;
        physics_consist.towed_rolling_stock = None;
        // When no user specified mass and towed rolling stock, we take traction_engine mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(15000.));
    }

    #[test]
    fn physics_consist_max_speed() {
        // Towed max speed 35
        let mut physics_consist = create_physics_consist();
        physics_consist.max_speed = Some(units::meter_per_second::new(20.0));
        physics_consist.traction_engine.max_speed = units::meter_per_second::new(22.0);

        // We take the smallest max speed
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(20.0)
        );

        physics_consist.max_speed = Some(units::meter_per_second::new(25.0));
        physics_consist.traction_engine.max_speed = units::meter_per_second::new(24.0);

        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(24.0)
        );

        physics_consist.max_speed = None;
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(24.0)
        );

        physics_consist.traction_engine.max_speed = units::meter_per_second::new(40.0);
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(35.0)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(40.0)
        );
    }

    #[test]
    fn physics_consist_compute_startup_acceleration() {
        let mut physics_consist = create_physics_consist(); // 0.06

        // We take the biggest
        assert_eq!(
            physics_consist.compute_startup_acceleration(),
            units::meter_per_second_squared::new(0.06)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_startup_acceleration(),
            units::meter_per_second_squared::new(0.04)
        );
    }

    #[test]
    fn physics_consist_compute_comfort_acceleration() {
        let mut physics_consist = create_physics_consist(); // 0.2

        // We take the smallest
        assert_eq!(
            physics_consist.compute_comfort_acceleration(),
            units::meter_per_second_squared::new(0.1)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_comfort_acceleration(),
            units::meter_per_second_squared::new(0.1)
        );
    }

    #[test]
    fn physics_consist_compute_inertia_coefficient() {
        let mut physics_consist = create_physics_consist();

        approx::assert_relative_eq!(physics_consist.compute_inertia_coefficient(), 1.065);

        physics_consist.towed_rolling_stock = None;
        assert_eq!(physics_consist.compute_inertia_coefficient(), 1.10,);
    }

    #[test]
    fn physics_consist_compute_rolling_resistance() {
        let mut physics_consist = create_physics_consist();

        assert_eq!(
            physics_consist.compute_rolling_resistance(),
            RollingResistance {
                rolling_resistance_type: "davis".to_string(),
                A: units::newton::new(35001.0),
                B: units::kilogram_per_second::new(350.01),
                C: units::kilogram_per_meter::new(7.0005),
            }
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_rolling_resistance(),
            physics_consist.traction_engine.rolling_resistance,
        );
    }

    #[test]
    fn physics_consist_compute_gamma() {
        // Towed const gamma 0.5
        let mut physics_consist = create_physics_consist();
        physics_consist.traction_engine.const_gamma = units::meter_per_second_squared::new(0.4);

        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.4)
        );

        physics_consist.traction_engine.const_gamma = units::meter_per_second_squared::new(0.6);
        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.5)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.6)
        );
    }
}
