use std::collections::BTreeSet;
use std::collections::HashMap;
use std::collections::HashSet;
use std::iter::Extend as _;
use std::sync::Arc;

use authz;
use authz::v2;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use common::units::millisecond;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::PathfindingInputError;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::signal_projection::SignalUpdate;
use core_client::simulation::PhysicsConsist;
use core_task::Correlated;
use core_task::SimulationOutput;
use core_task::pathfinding_request_from_consist_constraints;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use futures::StreamExt as _;
use itertools::Either;
use itertools::Itertools as _;
use itertools::izip;
use models::TrainScheduleException;
use models::prelude::*;
use models::round_trips::TrainScheduleRoundTrips;
use models::train_schedule::BaseTrainOrOccurrenceId;
use models::train_schedule::train_schedule_schema_from_model;
use reqwest::StatusCode;
use schemas::infra::OperationalPoint;
use schemas::paced_train::TrainSchedule;
use schemas::primitives::NonBlankString;
use schemas::primitives::TimeWindow;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::TrainScheduleLike as _;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AppState;
use crate::authentication;
use crate::error::EditoastError as _;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdQueryParam;
use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::projection::OperationalPointProjection;
use crate::views::projection::ProjectPathForm;
use crate::views::projection::ProjectPathOperationalPointForm;
use crate::views::projection::SpaceTimeCurve;
use crate::views::projection::compute_projected_train_path_op;
use crate::views::projection::compute_projected_train_path_op_without_simulation;
use crate::views::projection::compute_projected_train_paths;
use crate::views::rolling_stock::RollingStockError;
use crate::views::timetable::PhysicsConsistParameters;
use crate::views::timetable::occupancy_blocks::OccupancyBlockForm;
use crate::views::timetable::occupancy_blocks::OccupancyBlocks;
use crate::views::timetable::occupancy_blocks::compute_occupancy_blocks;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::SummaryResponse;
use crate::views::timetable::simulation::build_path_items_to_position;
use crate::views::timetable::simulation::build_pathfinding_consist;
use crate::views::timetable::simulation::build_sim_power_restriction_items;
use crate::views::timetable::simulation::build_sim_schedule_items;
use crate::views::timetable::simulation::train_simulation_ordered_batch;
use crate::views::timetable::track_occupancy;
use crate::views::timetable::track_occupancy::PathItemRelativeLocation;
use models::Infra;
use models::TrainScheduleSet;
use models::rolling_stock::RollingStock;
use models::train_schedule::OccurrenceId;
use models::train_schedule::TrainScheduleChangeset;

#[derive(Debug, Error, EditoastError, derive_more::From)]
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
    #[error("Exception '{exception_id}', could not be found")]
    #[editoast_error(status = 404)]
    ExceptionNotFound { exception_id: i64 },
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
    #[error(
        "Invalid path portion: start index '{begin}' and end index '{end}' are inconsistent with the path items count ('{path_items_count}')"
    )]
    #[editoast_error(status = 400)]
    InvalidPathPortion {
        begin: usize,
        end: usize,
        path_items_count: usize,
    },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(models::Error, database::DatabaseError)]
    Database(models::Error),
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
            train_schedule: train_schedule_schema_from_model(value, vec![]),
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
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
) -> Result<impl IntoResponse> {
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
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Json(train_schedule_base): Json<TrainSchedule>,
) -> Result<impl IntoResponse> {
    db_pool
        .get()
        .await?
        .transaction(async move |tx| {
            let train_schedule =
                models::TrainSchedule::retrieve_or_fail(tx.clone(), train_schedule_id, || {
                    TrainScheduleError::NotFound { train_schedule_id }
                })
                .await?;

            if !train_schedule.has_same_pace(train_schedule_base.clone().paced.as_ref()) {
                TrainScheduleException::delete_exceptions_for_train_schedule(
                    &mut tx.clone(),
                    train_schedule.id,
                )
                .await?;
            }

            let train_schedule_changeset: TrainScheduleChangeset = train_schedule_base.into();
            train_schedule_changeset
                .update_or_fail(&mut tx.clone(), train_schedule_id, || {
                    TrainScheduleError::NotFound { train_schedule_id }
                })
                .await?;
            Ok::<_, TrainScheduleError>(())
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleIds {
    ids: HashSet<i64>,
}

/// Delete a train schedule
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Json(TrainScheduleIds {
        ids: train_schedule_ids,
    }): Json<TrainScheduleIds>,
) -> Result<impl IntoResponse> {
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
    /// The key is the `exception_id`
    #[schema(value_type = HashMap<String, SummaryResponse>)]
    pub exceptions: HashMap<i64, SummaryResponse>,
}

#[derive(Default)]
struct TrainScheduleSummaryResponseBuilder {
    train_schedule: Option<SummaryResponse>,
    exceptions: HashMap<i64, SummaryResponse>,
}

impl TrainScheduleSummaryResponseBuilder {
    fn train_schedule(&mut self, summary_response: SummaryResponse) -> &mut Self {
        self.train_schedule = Some(summary_response);
        self
    }
    // Can be called multiple times for each exception to add
    fn add_exception(&mut self, exception_id: i64, summary_response: SummaryResponse) -> &mut Self {
        self.exceptions.insert(exception_id, summary_response);
        self
    }
    /// Only returns None if no summary response is available for the base occurrence
    fn build(self) -> Option<TrainScheduleSummaryResponse> {
        Some(TrainScheduleSummaryResponse {
            train_schedule: self.train_schedule?,
            exceptions: self.exceptions,
        })
    }
}

#[derive(Debug, Clone)]
struct SimulationContext {
    train_schedule_id: i64,
    exception_id: Option<i64>,
    train_schedule: schemas::TrainOccurrence,
}

/// Associate each train schedule id with its simulation summaries response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
        db_pool,
        valkey_client,
        core_client,
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(SimulationBatchForm {
        infra_id,
        timetable_id,
        electrical_profile_set_id,
        ids: train_schedule_ids,
    }): Json<SimulationBatchForm>,
) -> Result<Json<HashMap<i64, TrainScheduleSummaryResponse>>> {
    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
    .await?;

    /////
    // Init the simulation environment
    let core_env = core_task::CoreEnv {
        infra_id: infra.id as u64,
        infra_version: infra.version,
        client: core_client.clone(),
    };
    let mut simulation_env =
        if let Some(electrical_profile_set_id) = electrical_profile_set_id.map(|i| i as u64) {
            core_task::SimulationEnv::new_with_electrical_profile_set(
                core_env,
                electrical_profile_set_id,
            )
        } else {
            core_task::SimulationEnv::new(core_env)
        };

    /////
    // Generate the train simulation inputs
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
        &train_schedule_ids.into_iter().collect_vec(),
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.train_schedule_id);

    let train_occurrences = train_schedules
        .iter()
        .flat_map(|ts| {
            let ts_exceptions = exceptions.remove(&ts.id).unwrap_or_default();
            ts.iter_base_and_exceptions(&ts_exceptions).collect_vec()
        })
        .collect::<HashMap<_, _>>();

    // Get the physic consist parameters for the train schedules
    let rolling_stocks_ids = train_occurrences
        .values()
        .map::<String, _>(|train_occurrence| train_occurrence.rolling_stock_name.to_string())
        .collect::<HashSet<_>>();

    let consists =
        RollingStock::retrieve_batch_unchecked::<_, Vec<_>>(&mut conn.clone(), rolling_stocks_ids)
            .await
            .map_err(RollingStockError::from)?
            .into_iter()
            .map(|rolling_stock| {
                (
                    rolling_stock.name.clone(),
                    PhysicsConsistParameters::from_traction_engine(rolling_stock.into()),
                )
            })
            .collect::<HashMap<_, _>>();

    // Associate train schedules with their consist, when possible
    let (train_occurrences_with_physics_consist, not_found_rolling_stock_names) = train_occurrences
        .into_iter()
        .map(|(occurrence_id, train_occurrence)| {
            let rolling_stock_name = train_occurrence.rolling_stock_name.clone();
            consists
                .get(&rolling_stock_name)
                .map(|consist| (occurrence_id.clone(), (train_occurrence, consist)))
                .ok_or((occurrence_id, rolling_stock_name))
        })
        .partition_result::<HashMap<_, _>, Vec<_>, _, _>();

    // Build the operational point cache
    let path_items = train_occurrences_with_physics_consist
        .values()
        .flat_map(|(train_occurrence, _physics_consist)| &train_occurrence.path)
        .map(|path_item| &path_item.location)
        .collect_vec();
    let path_item_cache =
        OperationalPointCache::load_path_items(conn.clone(), infra.id, &path_items).await?;

    // Build the simulation trains for the simulation environment
    let (simulation_trains, pathfinding_failures): (Vec<_>, Vec<_>) =
        train_occurrences_with_physics_consist.iter().partition_map(
            |(occurrence_id, (train_occurrence, physics_consist_parameters))| {
                match simulation::build_simulation_train(
                    train_occurrence,
                    physics_consist_parameters,
                    &path_item_cache,
                ) {
                    Ok(simulation_train) => Either::Left((occurrence_id.clone(), simulation_train)),
                    Err(pathfinding_failure) => {
                        Either::Right((occurrence_id.clone(), pathfinding_failure))
                    }
                }
            },
        );

    /////
    // Populate the simulation environment and simulate
    simulation_env.extend(simulation_trains);
    let simulations = simulation_env
        .into_stream(valkey_client)
        .collect::<Vec<_>>()
        .await;

    /////
    // Prepare the API responses from the core simulation

    // Collect all the simulations per train schedule
    let simulation_summaries = simulations
        .into_iter()
        .flat_map(
            |Correlated {
                 correlation_key,
                 data,
             }| {
                // We need to duplicate all simulations outputs since the output must be flattend
                correlation_key
                    .into_iter()
                    .map(move |occurrence_id| (occurrence_id, data.clone()))
            },
        )
        .map(|(occurrence_id, data)| {
            let summary_response = match &data {
                Ok(simulation_output) => {
                    let train_occurrence = train_occurrences_with_physics_consist
                        .get(&occurrence_id)
                        .map(|(train_occurrence, _physic_consist)| train_occurrence)
                        .unwrap_or_else(|| {
                            panic!(
                                "no train schedule occurrence “{occurrence_id}” has been simulated"
                            )
                        });
                    SummaryResponse::from_simulation_output(simulation_output, train_occurrence)
                }
                Err(error) => SummaryResponse::SimulationFailed {
                    error_type: error.get_type().to_owned(),
                },
            };
            (occurrence_id, summary_response)
        })
        .chain(not_found_rolling_stock_names.into_iter().map(
            |(occurrence_id, rolling_stock_name)| {
                (
                    occurrence_id,
                    SummaryResponse::PathfindingInputError(
                        PathfindingInputError::RollingStockNotFound { rolling_stock_name },
                    ),
                )
            },
        ))
        .chain(
            pathfinding_failures
                .into_iter()
                .map(|(occurrence_id, pathfinding_failure)| {
                    (occurrence_id, SummaryResponse::from(pathfinding_failure))
                }),
        )
        .fold(
            HashMap::<i64, TrainScheduleSummaryResponseBuilder>::default(),
            |mut simulation_summaries, (occurrence_id, summary_response)| {
                match occurrence_id {
                    BaseTrainOrOccurrenceId::Base(train_schedule_id) => {
                        let builder = simulation_summaries.entry(train_schedule_id).or_default();
                        builder.train_schedule(summary_response);
                    }

                    BaseTrainOrOccurrenceId::Occurrence(occurrence_id) => match occurrence_id {
                        OccurrenceId::Base { .. } => {
                            unreachable!("We should not simulate base occurrence");
                        }
                        OccurrenceId::Modified {
                            train_schedule_id,
                            index: _,
                            exception_id,
                        }
                        | OccurrenceId::Created {
                            train_schedule_id,
                            exception_id,
                        } => {
                            let builder =
                                simulation_summaries.entry(train_schedule_id).or_default();
                            builder.add_exception(exception_id, summary_response);
                        }
                    },
                }
                simulation_summaries
            },
        )
        .into_iter()
        .map(
            |(train_schedule_id, train_schedule_summary_response_builder)| {
                (
                train_schedule_id,
                train_schedule_summary_response_builder.build().unwrap_or_else(|| panic!(
                    "no simulation was received for the paced train’s base ‘{train_schedule_id}’"
                )),
            )
            },
        )
        .collect();

    Ok(Json(simulation_summaries))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ExceptionQueryParam {
    exception_id: Option<i64>,
}

/// Selects a portion of a train schedule’s path.
#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct PathPortionQueryParam {
    /// Index of the first path item of the portion to include. Defaults to the path’s first item.
    begin_index: Option<usize>,
    /// Index of the last path item of the portion to include. Defaults to the path’s last item.
    end_index: Option<usize>,
}

/// Get a path from a train schedule given an infrastructure id and a train schedule id
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["train_schedule", "pathfinding"],
    params(TrainScheduleIdParam, InfraIdQueryParam, ExceptionQueryParam, PathPortionQueryParam),
    responses(
        (status = 200, description = "The path", body = PathfindingResult),
        (status = 404, description = "Infrastructure or Train schedule not found"),
        (status = 400, description = "Invalid path portion queried")
    )
)]
pub(in crate::views) async fn get_path(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ExceptionQueryParam { exception_id }): Query<ExceptionQueryParam>,
    Query(PathPortionQueryParam {
        begin_index,
        end_index,
    }): Query<PathPortionQueryParam>,
) -> Result<Json<PathfindingResult>> {
    let conn = db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
    .await?;

    let train_schedule =
        models::TrainSchedule::retrieve_or_fail(conn.clone(), train_schedule_id, || {
            TrainScheduleError::NotFound { train_schedule_id }
        })
        .await?;

    let train_occurrence = match exception_id {
        Some(exception_id) => {
            let exception =
                TrainScheduleException::retrieve_or_fail(conn.clone(), exception_id, || {
                    TrainScheduleError::ExceptionNotFound { exception_id }
                })
                .await?;
            train_schedule.apply_train_schedule_exception(&exception.into())
        }
        None => train_schedule.into_train_occurrence(),
    };

    let rolling_stock_name = train_occurrence.rolling_stock_name().to_owned();
    let Some(consist) = RollingStock::retrieve(conn.clone(), rolling_stock_name.clone())
        .await?
        .map(schemas::RollingStock::from)
        .map(PhysicsConsistParameters::from_traction_engine)
    else {
        let failure = PathfindingFailure::PathfindingInputError(
            PathfindingInputError::RollingStockNotFound { rolling_stock_name },
        );
        return Ok(Json(PathfindingResult::Failure(failure)));
    };

    // The path items are kept whole, and not only their location, to relate each of them to its
    // schedule item below
    let path = train_occurrence.path();

    let path = match (begin_index, end_index) {
        (None, None) => path,
        (begin_index, end_index) => {
            let path_items_count = path.len();
            let begin = begin_index.unwrap_or(0);
            let end = end_index.unwrap_or(path_items_count.saturating_sub(1));
            if begin > end || end >= path_items_count {
                return Err(TrainScheduleError::InvalidPathPortion {
                    begin,
                    end,
                    path_items_count,
                }
                .into());
            }
            &path[begin..=end]
        }
    };

    let path_items = path
        .iter()
        .map(|path_item| &path_item.location)
        .collect_vec();

    let track_offsets = match OperationalPointCache::load_path_items(conn, infra.id, &path_items)
        .await?
        .extract_location_from_path_items(&path_items)
    {
        Ok(track_offsets) => track_offsets,
        Err(err) => return Ok(Json(PathfindingResult::Failure(err))),
    };

    // A train can backtrack on a waypoint when its corresponding schedule item says so
    let backtrack_path_item_ids = train_occurrence
        .schedule()
        .iter()
        .filter(|schedule_item| schedule_item.can_backtrack)
        .map(|schedule_item| &schedule_item.at)
        .collect::<HashSet<_>>();

    let constraints = core_task::PathfindingConstraints {
        path_items: path
            .iter()
            .zip(track_offsets)
            .map(
                |(path_item, path_item_alternatives)| core_task::PathItemConstraint {
                    path_item_alternatives,
                    can_backtrack: backtrack_path_item_ids.contains(&path_item.id),
                },
            )
            .collect(),
        allowed_track_sections: BTreeSet::new(),
    };

    let consist = build_pathfinding_consist(&consist, train_occurrence.speed_limit_tag().cloned());
    let pathfinding_request = pathfinding_request_from_consist_constraints(
        infra.id,
        infra.version,
        &consist,
        &constraints,
    );

    use core_task::Task as _;
    let result = pathfinding_request.run(valkey_client, core_client).await?;
    Ok(Json(result.into()))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct ElectricalProfileSetIdQueryParam {
    electrical_profile_set_id: Option<i64>,
}

/// Retrieve the space, speed and time curve of a given train
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
        valkey_client,
        core_client,
        db_pool,
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
    Query(ExceptionQueryParam { exception_id }): Query<ExceptionQueryParam>,
) -> Result<Json<simulation::Response>> {
    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
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
                || TrainScheduleError::ExceptionNotFound { exception_id },
            )
            .await?;
            train_schedule.apply_train_schedule_exception(&exception.into())
        }
        None => train_schedule.into_train_occurrence(),
    };

    let rolling_stock_name = train_schedule.rolling_stock_name().to_owned();
    let Some(consist) = RollingStock::retrieve(db_pool.get().await?, rolling_stock_name.clone())
        .await?
        .map(|rs| PhysicsConsistParameters::from_traction_engine(rs.into()))
    else {
        return Ok(Json(simulation::Response::PathfindingFailed {
            pathfinding_failed: PathfindingFailure::PathfindingInputError(
                PathfindingInputError::RollingStockNotFound { rolling_stock_name },
            ),
        }));
    };

    let path_item_locations = train_schedule.locations();
    let op_cache = OperationalPointCache::load_path_items(
        db_pool.get().await?,
        infra.id,
        &path_item_locations,
    )
    .await?;
    let simulation_train =
        match simulation::build_simulation_train(&train_schedule, &consist, &op_cache) {
            Ok(simulation_train) => simulation_train,
            Err(pathfinding_failed) => {
                return Ok(Json(simulation::Response::PathfindingFailed {
                    pathfinding_failed,
                }));
            }
        };

    let core_env = core_task::CoreEnv {
        infra_id: infra.id as u64,
        infra_version: infra.version,
        client: core_client.clone(),
    };
    let mut simulation_env = match electrical_profile_set_id {
        Some(electrical_profile_set_id) => {
            core_task::SimulationEnv::new_with_electrical_profile_set(
                core_env,
                electrical_profile_set_id as u64,
            )
        }
        None => core_task::SimulationEnv::new(core_env),
    };
    // We only have one element, so we use Unit as correlation key
    simulation_env.extend([((), simulation_train)]);

    let result = match simulation_env.into_stream(valkey_client).next().await {
        Some(simulation) => simulation.data,
        None => Err(core_client::Error::BrokenPipe),
    };

    let result = match result {
        Ok(SimulationOutput::Success(success)) => simulation::Response::Success(success.into()),
        Ok(SimulationOutput::PathfindingFailure(pathfinding_failed)) => {
            match PathfindingResult::from(pathfinding_failed) {
                PathfindingResult::Failure(pathfinding_failed) => {
                    simulation::Response::PathfindingFailed { pathfinding_failed }
                }
                _ => unreachable!("simulation only returns errors of pathfinding in this field"),
            }
        }
        Err(err) => simulation::Response::SimulationFailed {
            core_error: err.into(),
        },
    };

    Ok(Json(result))
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
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Path(TrainScheduleIdParam {
        id: train_schedule_id,
    }): Path<TrainScheduleIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
    Query(ExceptionQueryParam { exception_id }): Query<ExceptionQueryParam>,
) -> Result<Json<core_client::etcs_braking_curves::Response>> {
    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        TrainScheduleError::InfraNotFound { infra_id }
    })
    .await?;

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
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
                    || TrainScheduleError::ExceptionNotFound { exception_id },
                )
                .await?
                .into();
            train_schedule.apply_train_schedule_exception(&exception)
        }
        None => train_schedule.clone().into_train_occurrence(),
    };

    // Compute simulation of a train schedule
    let (simulation_result, pathfinding_result) = train_simulation_ordered_batch(
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
    let schedule = build_sim_schedule_items(
        &train_occurrence.schedule,
        &path_items_to_position,
        &train_schedule.path,
        None,
    );
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
    #[schema(value_type = HashMap<String, Vec<SpaceTimeCurve>>)]
    pub exceptions: HashMap<i64, Vec<SpaceTimeCurve>>,
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
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
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

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
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
        &train_schedule_ids,
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
                train_schedule_id: train_schedule.id,
                exception_id: None,
                train_schedule: train_schedule.clone().into_train_occurrence(),
            })
            .chain(ts_exceptions.iter().map(|exception| SimulationContext {
                train_schedule_id: train_schedule.id,
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
            if let Some(exception_id) = simulation_context.exception_id {
                if !Arc::ptr_eq(&base_project_path, &project_path_result[index]) {
                    results
                        .get_mut(&simulation_context.train_schedule_id)
                        .expect("train_schedule_id should exist")
                        .exceptions
                        .insert(exception_id, (*project_path_result[index]).clone());
                }
            } else {
                results.insert(
                    simulation_context.train_schedule_id,
                    ProjectPathTrainScheduleResult {
                        train_schedule: (*project_path_result[index]).clone(),
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
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
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

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
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
        &train_ids.into_iter().collect_vec(),
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

    let path_item_locations = train_schedules
        .iter()
        .flat_map(|ts| ts.path.iter().map(|p| &p.location))
        .chain(&path_item_locations_projection)
        .collect_vec();

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
                    exception_id,
                    ..
                }
                | OccurrenceId::Created {
                    train_schedule_id,
                    exception_id,
                    ..
                } => {
                    if !Arc::ptr_eq(&base_project_path, &projected_train) {
                        results
                            .entry(train_schedule_id)
                            .or_insert_with(|| ProjectPathTrainScheduleResult {
                                train_schedule: (*projected_train).clone(),
                                exceptions: HashMap::new(),
                            })
                            .exceptions
                            .insert(exception_id, (*projected_train).clone());
                    }
                }
                OccurrenceId::Base {
                    train_schedule_id, ..
                } => {
                    results
                        .entry(train_schedule_id)
                        .or_insert_with(|| ProjectPathTrainScheduleResult {
                            train_schedule: Arc::unwrap_or_clone(projected_train.clone()),
                            exceptions: HashMap::new(),
                        })
                        .train_schedule = (*projected_train).clone();
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
    pub exceptions: HashMap<i64, OccupancyBlocks>,
}

/// ## Important:
/// The following train schedules are **excluded** from the result:
/// - train schedules for which pathfinding fails
/// - train schedules for which the simulation fails
/// - train schedules for which the simulation does not respect schedule times
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(OccupancyBlockForm {
        infra_id,
        timetable_id,
        ids: train_schedule_ids,
        path,
        electrical_profile_set_id,
    }): Json<OccupancyBlockForm>,
) -> Result<Json<HashMap<i64, OccupancyBlocksTrainScheduleResult>>> {
    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
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

    let mut exceptions = models::TrainScheduleException::retrieve_exceptions_by_train_schedules(
        conn,
        timetable_id,
        &train_schedules.iter().map(|t| t.id).collect::<Vec<_>>(),
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
                train_schedule_id: train_schedule.id,
                exception_id: None,
                train_schedule: train_schedule.clone().into_train_occurrence(),
            })
            .chain(
                ts_exceptions
                    .iter()
                    .map(|exception| SimulationContext {
                        train_schedule_id: train_schedule.id,
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
        if let Some(exception_id) = simulation_context.exception_id {
            if !Arc::ptr_eq(&base_occupancy_blocks, &occupancy_blocks_result[index]) {
                results
                    .get_mut(&simulation_context.train_schedule_id)
                    .expect("train_schedule_id should exist")
                    .exceptions
                    .insert(
                        exception_id,
                        Arc::unwrap_or_clone(occupancy_blocks_result[index].clone()),
                    );
            }
        } else {
            results.insert(
                simulation_context.train_schedule_id,
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
#[schema(as = TrainScheduleTrackOccupancyForm)]
pub(in crate::views) struct TrackOccupancyForm {
    train_schedule_ids: Vec<i64>,
    operational_point_reference: OperationalPointReference,
    infra_id: i64,
    timetable_id: i64,
    electrical_profile_set_id: Option<i64>,
    use_simulation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(as = TrainScheduleTrackOccupancy)]
pub(in crate::views) struct TrackOccupancy {
    #[serde(flatten)]
    #[schema(inline)]
    train_id: OccurrenceId,
    #[serde(flatten)]
    #[schema(inline)]
    time_window: TimeWindow,
    path_item_relative_location: PathItemRelativeLocation,
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

#[editoast_derive::route(authz::Role::OperationalStudies)]
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
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(TrackOccupancyForm {
        train_schedule_ids,
        operational_point_reference,
        infra_id,
        timetable_id,
        electrical_profile_set_id,
        use_simulation,
    }): Json<TrackOccupancyForm>,
) -> Result<Json<Vec<TrackSectionOccupancy>>> {
    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
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
        &train_schedule_ids,
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.train_schedule_id);

    let (train_ids, trains): (Vec<_>, Vec<_>) = train_schedules
        .iter()
        .flat_map(|train_schedule| {
            train_schedule
                .iter_occurrences(&exceptions.remove(&train_schedule.id).unwrap_or_default())
                .collect_vec()
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

    let operational_point = op_cache.get_reference(operational_point_reference.clone());

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

    let simulations_result = train_simulation_ordered_batch(
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
                          path_item_relative_location,
                      }| {
                    (
                        local_track_name,
                        TrackOccupancy {
                            train_id: train_id.clone(),
                            time_window,
                            path_item_relative_location,
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
                          path_item_relative_location,
                      }| {
                    (
                        local_track_name,
                        TrackOccupancy {
                            train_id: train_id.clone(),
                            time_window,
                            path_item_relative_location,
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
                                train_schedule.start_time + millisecond::i64::new(arrival_time);
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
                            path_item_relative_location: PathItemRelativeLocation::ExactPathItem {
                                path_item_id: path_item.id.clone(),
                            },
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

#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Json(MoveTrainSchedulesForm {
        train_schedule_ids,
        train_schedule_set_id,
    }): Json<MoveTrainSchedulesForm>,
) -> Result<impl IntoResponse> {
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
    use chrono::Duration;
    use chrono::TimeDelta;
    use core_client::mocking::MockingClient;
    use core_client::pathfinding::InvalidPathItem;
    use core_client::pathfinding::PathfindingInputError;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrackRange;
    use core_client::pathfinding::TrainPath;
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ElectricalProfiles;
    use core_client::simulation::ReportTrain;
    use core_client::simulation::SpeedLimitProperties;
    use database::DbConnectionPoolV2;
    use models::TrainScheduleException;

    use models::rolling_stock::TrainMainCategory;
    use models::timetable::Timetable;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::fixtures::ms_since_epoch;
    use schemas::infra::Direction;
    use schemas::paced_train::InitialSpeedChangeGroup;
    use schemas::paced_train::Paced;
    use schemas::paced_train::PathAndScheduleChangeGroup;
    use schemas::paced_train::RollingStockChangeGroup;
    use schemas::paced_train::TrainNameChangeGroup;
    use schemas::paced_train::TrainSchedule;
    use schemas::primitives::NonBlankString;
    use schemas::primitives::PositiveDuration;
    use schemas::rolling_stock::TrainCategory;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::MarginValue;
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

    use crate::fixtures::create_fast_rolling_stock;
    use crate::fixtures::create_rolling_stock_with_energy_sources;
    use crate::fixtures::create_simple_paced_train;
    use crate::fixtures::create_small_infra;
    use crate::fixtures::create_timetable;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::fixtures::create_train_schedule_exception;
    use crate::fixtures::create_train_schedule_set;
    use crate::fixtures::simple_paced_train_base;
    use crate::fixtures::simple_paced_train_changeset;
    use crate::fixtures::simple_sub_category;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;

    use crate::views::tests::mocked_core_pathfinding_sim_and_proj;
    use crate::views::timetable::simulation;
    use crate::views::timetable::simulation::SimulationResponseSuccess;
    use crate::views::timetable::simulation::SummaryResponse;
    use crate::views::timetable::simulation_empty_response;
    use axum_test::TestResponse;
    use models::train_schedule::OccurrenceId;
    use models::train_schedule::TrainScheduleChangeset;

    pub fn new_op_with_main_code_and_local_track_name(
        id: &str,
        country_code: &str,
        main_code: &str,
        secondary_code: Option<NonBlankString>,
        local_track_name: Option<NonBlankString>,
    ) -> PathItem {
        PathItem {
            id: id.into(),
            location: PathItemLocation::OperationalPointPartReference(
                OperationalPointPartReference {
                    operational_point: OperationalPointReference::Domestic {
                        country_code: country_code.into(),
                        main_code: main_code.into(),
                        secondary_code,
                    },
                    local_track_name,
                },
            ),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_post() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule = simple_paced_train_base();
        // Insert train schedule

        let response: Vec<TrainScheduleResponse> = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&json!(vec![train_schedule]))
            .await
            .assert_status(StatusCode::CREATED)
            .json();
        assert_eq!(response.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_with_sub_category() {
        let app = test_app!().skip_authz().build();
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

        let response: Vec<TrainScheduleResponse> = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&json!(vec![train_schedule]))
            .await
            .assert_status(StatusCode::CREATED)
            .json();

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
        let created_paced_train: schemas::paced_train::TrainSchedule =
            train_schedule_schema_from_model(created_paced_train, vec![]);

        assert_eq!(
            created_paced_train.train_occurrence.category,
            Some(TrainCategory::Sub {
                sub_category_code: created_sub_category.code.clone()
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train_resets_exceptions_when_interval_changes() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut pool.get_ok()).await;

        let simple_train_schedule = simple_paced_train_changeset(train_schedule_set.id);
        let train_schedule = simple_train_schedule
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let _exception_1 = create_train_schedule_exception(
            &mut pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("exception_1".to_string()),
            None,
        )
        .await;

        let _exception_2 = create_train_schedule_exception(
            &mut pool.get_ok(),
            timetable.id,
            train_schedule.id,
            Some(0),
            Some("exception_2".to_string()),
            None,
        )
        .await;

        let exceptions_before = TrainScheduleException::retrieve_exceptions_by_train_schedules(
            &mut pool.get_ok(),
            timetable.id,
            &[train_schedule.id],
        )
        .await
        .expect("Failed to retrieve exceptions before update");
        assert_eq!(exceptions_before.len(), 2);

        let mut updated_train_schedule = simple_paced_train_base();
        updated_train_schedule.paced.as_mut().unwrap().interval =
            chrono::Duration::minutes(30).try_into().unwrap();

        app.put(&format!(
            "/train_schedules/{}?timetable_id={}",
            train_schedule.id, timetable.id
        ))
        .json(&json!(&updated_train_schedule))
        .await
        .assert_status_no_content();

        let exceptions_after = TrainScheduleException::retrieve_exceptions_by_train_schedules(
            &mut pool.get_ok(),
            timetable.id,
            &[train_schedule.id],
        )
        .await
        .expect("Failed to retrieve exceptions after update");

        assert!(
            exceptions_after.is_empty(),
            "Expected exceptions to be reset after interval change, but found {}",
            exceptions_after.len()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_paced_train() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let mut paced_train_base = simple_paced_train_base();
        paced_train_base.paced.as_mut().unwrap().time_window =
            Duration::minutes(90).try_into().unwrap();
        paced_train_base.paced.as_mut().unwrap().interval =
            Duration::minutes(15).try_into().unwrap();

        app.put(
            format!(
                "/train_schedules/{}?timetable_id={}",
                paced_train.id, timetable.id
            )
            .as_str(),
        )
        .json(&json!(&paced_train_base))
        .await
        .assert_status_no_content();

        let updated_paced_train = models::TrainSchedule::retrieve(pool.get_ok(), paced_train.id)
            .await
            .expect("Failed to retrieve updated paced train")
            .expect("Updated paced train not found");

        assert_eq!(
            paced_train_base,
            train_schedule_schema_from_model(updated_paced_train, vec![])
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_delete() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let _ = app
            .delete("/train_schedules/")
            .json(&json!({"ids": vec![train_schedule.id]}))
            .await
            .assert_status_no_content();

        let exists = models::TrainSchedule::exists(&mut pool.get_ok(), train_schedule.id)
            .await
            .expect("Failed to retrieve train_schedule");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_not_found_train_schedule() {
        let app = test_app!().skip_authz().build();
        let response: InternalError = app
            .get(&format!("/train_schedules/{}", 0))
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(&response.error_type, "editoast:train_schedule:NotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let response = app
            .get(&format!("/train_schedules/{}", paced_train.id))
            .await
            .assert_status_ok()
            .json::<TrainScheduleResponse>();

        assert_eq!(
            response.train_schedule,
            train_schedule_schema_from_model(paced_train, vec![])
        );
    }

    struct SimulationTestsSetup {
        app: TestApp,
        infra_id: i64,
        timetable: Timetable,
        train_schedule: models::TrainSchedule,
        exception: TrainScheduleException,
    }

    async fn simulation_tests_initial_setup() -> SimulationTestsSetup {
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
        let app = test_app!()
            .skip_authz()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();
        SimulationTestsSetup {
            app,
            infra_id: small_infra.id,
            timetable,
            train_schedule,
            exception,
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation() {
        let SimulationTestsSetup {
            app,
            infra_id,
            train_schedule,
            ..
        } = simulation_tests_initial_setup().await;
        let response: core_client::simulation::Response = app
            .get(
                format!(
                    "/train_schedules/{}/simulation/?infra_id={infra_id}",
                    train_schedule.id
                )
                .as_str(),
            )
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            response,
            simulation_empty_response(TrainOccurrence::FAKE_PATH_LEN)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_exception_simulation_with_invalid_exception_key() {
        let SimulationTestsSetup {
            app,
            infra_id,
            train_schedule,
            ..
        } = simulation_tests_initial_setup().await;
        let response: InternalError = app
            .get(
                format!(
                    "/train_schedules/{}/simulation/?infra_id={infra_id}&exception_id=9999",
                    train_schedule.id
                )
                .as_str(),
            )
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule:ExceptionNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_exception_simulation() {
        let SimulationTestsSetup {
            app,
            infra_id,
            train_schedule,
            exception,
            ..
        } = simulation_tests_initial_setup().await;
        let response: simulation::Response = app
            .get(
                format!(
                    "/train_schedules/{}/simulation/?infra_id={infra_id}&exception_id={}",
                    train_schedule.id, exception.id
                )
                .as_str(),
            )
            .await
            .assert_status_ok()
            .json();

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
        let SimulationTestsSetup {
            app,
            infra_id,
            train_schedule,
            exception,
            ..
        } = simulation_tests_initial_setup().await;

        let mut change_group = exception.change_groups;
        change_group.rolling_stock = Some(RollingStockChangeGroup {
            rolling_stock_name: "R2D2".into(),
            comfort: Comfort::AirConditioning,
        });
        let exception = models::TrainScheduleException::changeset()
            .change_groups(change_group)
            .update(&mut app.db_pool().get_ok(), train_schedule.id)
            .await
            .expect("Fail to update exception")
            .expect("Fail to update exception");

        // WHEN
        let response: simulation::Response = app
            .get(
                format!(
                    "/train_schedules/{}/simulation/?infra_id={infra_id}&exception_id={}",
                    train_schedule.id, exception.id
                )
                .as_str(),
            )
            .await
            .assert_status_ok()
            .json();

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
        let SimulationTestsSetup { app, infra_id, .. } = simulation_tests_initial_setup().await;
        let response: InternalError = app
            .get(format!("/train_schedules/{}/simulation/?infra_id={}", 0, infra_id).as_str())
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(&response.error_type, "editoast:train_schedule:NotFound")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary() {
        // Setup tests tools
        let core = mocked_core_pathfinding_sim_and_proj();
        let app = test_app!()
            .skip_authz()
            .db_pool(DbConnectionPoolV2::for_tests())
            .core_client(core.into())
            .build();
        let db_pool = app.db_pool();

        // Setup tests data
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        create_rolling_stock_with_energy_sources(
            &mut app.db_pool().get_ok(),
            "exception_rolling_stock",
        )
        .await;

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
        let _exception_1 = create_train_schedule_exception(
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
        let exception_2 = create_train_schedule_exception(
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

        // Add one exception which will change the simulation from base with another rolling stock
        let exception_3 = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            Some(2),
            Some("change_rolling_stock".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                rolling_stock: Some(RollingStockChangeGroup {
                    rolling_stock_name: "exception_rolling_stock".to_string(),
                    // This property is what make the simulation request different
                    // hence producing a different simulation
                    comfort: Comfort::AirConditioning,
                }),
                ..Default::default()
            }),
        )
        .await;

        // Add one exception with a different path whose path item don’t exists
        let exception_4 = create_train_schedule_exception(
            &mut db_pool.get_ok(),
            timetable.id,
            train_schedule.id,
            None,
            Some("unknown_path_item".to_string()),
            Some(TrainScheduleExceptionChangeGroups {
                path_and_schedule: Some(PathAndScheduleChangeGroup {
                    path: vec![
                        PathItem::new_operational_point("unknown_origin"),
                        PathItem::new_operational_point("unknown_destination"),
                    ],
                    schedule: vec![],
                    margins: schemas::train_schedule::Margins {
                        boundaries: vec![],
                        values: vec![MarginValue::MinPer100Km(2.0_f64)],
                    },
                    power_restrictions: vec![],
                }),
                ..Default::default()
            }),
        )
        .await;

        let mut response: HashMap<i64, TrainScheduleSummaryResponse> = app
            .post("/train_schedules/simulation_summary")
            .json(&json!({
                "infra_id": small_infra.id,
                "timetable_id": timetable.id,
                "ids": vec![train_schedule.id],
            }))
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.len(), 1);

        let TrainScheduleSummaryResponse {
            train_schedule,
            exceptions,
        } = response.remove(&train_schedule.id).unwrap();
        assert_eq!(
            train_schedule,
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
        );

        assert_eq!(
            exceptions.get(&exception_3.id).unwrap(),
            // Simulation of the exception is the same than base
            // because all simulation results from core are identical stubs
            &SummaryResponse::Success {
                length: 15_050_000,
                time: 3,
                energy_consumption: 0.0,
                path_item_times_final: vec![0, 1, 2, 3],
                path_item_times_provisional: vec![0, 1, 2, 3],
                path_item_times_base: vec![0, 1, 2, 3],
                path_item_respect_times: vec![true, false, true, false],
                path_item_respect_margins: vec![true, true, true, true],
            }
        );
        assert_eq!(
            exceptions.get(&exception_2.id).unwrap(),
            // Simulation of the exception is the same than base
            // because all simulation results from core are identical stubs
            &SummaryResponse::Success {
                length: 15_050_000,
                time: 3,
                energy_consumption: 0.0,
                path_item_times_final: vec![0, 1, 2, 3],
                path_item_times_provisional: vec![0, 1, 2, 3],
                path_item_times_base: vec![0, 1, 2, 3],
                path_item_respect_times: vec![true, false, true, false],
                path_item_respect_margins: vec![true, true, true, true],
            }
        );
        assert_eq!(
            exceptions.get(&exception_4.id).unwrap(),
            &SummaryResponse::PathfindingInputError(PathfindingInputError::InvalidPathItems {
                items: vec![
                    InvalidPathItem {
                        index: 0,
                        path_item: PathItemLocation::OperationalPointPartReference(
                            OperationalPointPartReference {
                                operational_point: OperationalPointReference::Id {
                                    operational_point: "unknown_origin".into(),
                                },
                                local_track_name: None,
                            },
                        )
                    },
                    InvalidPathItem {
                        index: 1,
                        path_item: PathItemLocation::OperationalPointPartReference(
                            OperationalPointPartReference {
                                operational_point: OperationalPointReference::Id {
                                    operational_point: "unknown_destination".into(),
                                },
                                local_track_name: None,
                            },
                        )
                    }
                ]
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary_with_all_occurrences_disabled() {
        let core = mocked_core_pathfinding_sim_and_proj();
        let app = test_app!()
            .skip_authz()
            .db_pool(DbConnectionPoolV2::for_tests())
            .core_client(core.into())
            .build();
        let db_pool = app.db_pool();

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

        for i in 0..4 {
            TrainScheduleException::changeset()
                .timetable_id(timetable.id)
                .train_schedule_id(train_schedule.id)
                .occurrence_index(Some(i))
                .key(Some(format!("disabled_occurrence_{}", i)))
                .disabled(true)
                .change_groups(TrainScheduleExceptionChangeGroups {
                    initial_speed: Some(InitialSpeedChangeGroup { value: 1.23 }),
                    ..Default::default()
                })
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create exception");
        }

        let mut response: HashMap<i64, TrainScheduleSummaryResponse> = app
            .post("/train_schedules/simulation_summary")
            .json(&json!({
                "infra_id": small_infra.id,
                "timetable_id": timetable.id,
                "ids": vec![train_schedule.id],
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.len(), 1);
        let train_schedule_summary = response
            .remove(&train_schedule.id)
            .expect("missing simulation summary for train schedule");
        assert_eq!(train_schedule_summary.exceptions.len(), 4);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_simulation_summary_not_found() {
        let SimulationTestsSetup { app, infra_id, .. } = simulation_tests_initial_setup().await;
        let timetable = create_timetable(&mut app.db_pool().get_ok()).await;
        let response: InternalError = app
            .post("/train_schedules/simulation_summary")
            .json(&json!({
                "infra_id": infra_id,
                "timetable_id": timetable.id,
                "ids": vec![0],
            }))
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule:BatchNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_infra_not_found() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let response: InternalError = app
            .get(&format!(
                "/train_schedules/{}/path?infra_id={}",
                paced_train.id, 0
            ))
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule:InfraNotFound"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_not_found() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();
        let small_infra = create_small_infra(&mut pool.get_ok()).await;

        let response: InternalError = app
            .get(&format!(
                "/train_schedules/{}/path?infra_id={}",
                0, small_infra.id
            ))
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(&response.error_type, "editoast:train_schedule:NotFound");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_with_invalid_exception_key() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();
        let small_infra = create_small_infra(&mut pool.get_ok()).await;
        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;
        let response: InternalError = app
            .get(
                format!(
                    "/train_schedules/{}/path/?infra_id={}&exception_id=1234",
                    paced_train.id, small_infra.id
                )
                .as_str(),
            )
            .await
            .assert_status_not_found()
            .json();

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
                "backtrack_path_items": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = test_app!().skip_authz().core_client(core.into()).build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let response = app
            .get(&format!(
                "/train_schedules/{}/path?infra_id={}",
                paced_train.id, small_infra.id
            ))
            .await
            .assert_status_ok()
            .json::<PathfindingResult>();

        assert_eq!(
            response,
            PathfindingResult::Success(PathfindingResultSuccess {
                path: TrainPath {
                    blocks: vec![],
                    routes: vec![],
                    track_section_ranges: vec![],
                },
                path_item_positions: vec![],
                backtrack_path_items: Some(vec![]),
                length: 1
            })
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_with_bounds() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .on_body(
                "/path_items",
                json!([
                    {
                        "locations": [{ "track": "TC0", "offset": 340 }],
                        "can_backtrack": false
                    },
                    {
                        "locations": [
                            { "track": "TC0", "offset": 550000 },
                            { "track": "TC1", "offset": 550000 },
                            { "track": "TC2", "offset": 450000 },
                            { "track": "TC3", "offset": 450000 }
                        ],
                        "can_backtrack": false
                    }
                ]),
            )
            .response(StatusCode::OK)
            .json(json!({
                "path": {
                    "blocks":[],
                    "routes": [],
                    "track_section_ranges": [],
                },
                "path_item_positions": [],
                "backtrack_path_items": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = test_app!().skip_authz().core_client(core.into()).build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        app.get(&format!(
            "/train_schedules/{}/path?infra_id={}&begin_index=1&end_index=2",
            paced_train.id, small_infra.id
        ))
        .await
        .assert_status_ok();
    }

    #[rstest]
    #[case(2, 100)] // end_index > path_items_count
    #[case(2, 1)] // begin_index > end_index
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_train_path_invalid_portion(
        #[case] begin_index: usize,
        #[case] end_index: usize,
    ) {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get_ok()).await;
        let paced_train =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let response: InternalError = app
            .get(&format!(
                "/train_schedules/{}/path?infra_id={}&begin_index={}&end_index={}",
                paced_train.id, small_infra.id, begin_index, end_index
            ))
            .await
            .assert_status_bad_request()
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule:InvalidPathPortion"
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
        let app = test_app!().skip_authz().core_client(core.into()).build();
        let db_pool = app.db_pool();

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

        let train_schedule =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;

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

        let response = app
            .get(&format!(
                "/train_schedules/{}/path?infra_id={}&exception_id={}",
                train_schedule.id, small_infra.id, change_rolling_stock_exception.id
            ))
            .await
            .assert_status_ok()
            .json::<PathfindingResult>();

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
                "backtrack_path_items": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = test_app!().skip_authz().core_client(core.into()).build();
        let db_pool = app.db_pool();

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

        create_fast_rolling_stock(&mut db_pool.get_ok(), "R2D2").await;

        let train_schedule =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;

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

        let response = app
            .get(&format!(
                "/train_schedules/{}/path?infra_id={}&exception_id={}",
                train_schedule.id, small_infra.id, change_train_name_exception.id
            ))
            .await
            .assert_status_ok()
            .json::<PathfindingResult>();

        assert_eq!(
            response,
            PathfindingResult::Success(PathfindingResultSuccess {
                path: TrainPath {
                    blocks: vec![],
                    routes: vec![],
                    track_section_ranges: vec![],
                },
                path_item_positions: vec![],
                backtrack_path_items: Some(vec![]),
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
            .start_time(millisecond::i64::new(0))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let core = mocked_core_pathfinding_sim_and_proj();
        let app = test_app!()
            .skip_authz()
            .db_pool(db_pool)
            .core_client(core.into())
            .build();

        // TEST
        let response: HashMap<i64, ProjectPathTrainScheduleResult> = app
            .post("/train_schedules/project_path")
            .json(&json!({
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
            }))
            .await
            .assert_status_ok()
            .json();
        // EXPECT
        // TODO: improve this test
        assert_eq!(response.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_occupancy_blocks() {
        let SimulationTestsSetup {
            app,
            infra_id,
            timetable,
            train_schedule,
            exception,
        } = simulation_tests_initial_setup().await;
        let db_pool = app.db_pool();

        // First remove all already generated exceptions
        exception
            .delete(&mut db_pool.get_ok())
            .await
            .expect("Failed to remove exception");

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

        let response = app
            .post("/train_schedules/occupancy_blocks")
            .json(&json!({"ids": vec![train_schedule.id],
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
            }))
            .await;
        let response: HashMap<i64, OccupancyBlocksTrainScheduleResult> =
            response.assert_status_ok().json();
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
            backtrack_path_items: Some(vec![]),
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
            .json(simulation_empty_response(path.len()))
            .finish();
        let app = test_app!().skip_authz().core_client(core.into()).build();
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

        app.post("/train_schedules/track_occupancy")
            .json(&TrackOccupancyForm {
                train_schedule_ids: vec![train_schedule.id],
                operational_point_reference,
                infra_id: small_infra.id,
                timetable_id: timetable.id,
                electrical_profile_set_id: None,
                use_simulation,
            })
            .await
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
            response.await.assert_status_ok().json();

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
            response.await.assert_status_ok().json();

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
            response.await.assert_status_ok().json();

        assert!(track_occupancies.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn move_train_schedules_to_another_train_schedule_set() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get_ok()).await;
        let train_schedule =
            create_simple_paced_train(&mut db_pool.get_ok(), train_schedule_set.id).await;

        let train_schedule_set_to_move = create_train_schedule_set(&mut db_pool.get_ok()).await;

        let move_form = MoveTrainSchedulesForm {
            train_schedule_ids: vec![train_schedule.id],
            train_schedule_set_id: train_schedule_set_to_move.id,
        };
        app.patch("/train_schedules/move")
            .json(&move_form)
            .await
            .assert_status_no_content();

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
                new_op_with_main_code_and_local_track_name(
                    "Mid_West_station",
                    "FR",
                    "MWS",
                    None,
                    None,
                ),
                new_op_with_main_code_and_local_track_name(
                    "UNKNOWN_ID",
                    "UNKNOWN_COUNTRY_CODE",
                    "UNKNOWN_MAIN_CODE",
                    None,
                    Some(NonBlankString("UNKNOWN_V".to_string())),
                ),
                new_op_with_main_code_and_local_track_name(
                    "Mid_East_station",
                    "FR",
                    "MES",
                    None,
                    None,
                ),
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
                    ..Default::default()
                },
                ScheduleItem::new_with_stop(
                    "Mid_East_station",
                    Duration::new(0, 0).expect("Failed to parse duration"),
                ),
            ],
            OperationalPointReference::Domestic {
                country_code: "UNKNOWN_COUNTRY_CODE".into(),
                main_code: "UNKNOWN_MAIN_CODE".into(),
                secondary_code: None,
            },
            use_simulation,
        );
        let track_occupancies: Vec<TrackSectionOccupancy> =
            response.await.assert_status_ok().json();
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
            response.await.assert_status_ok().json();

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
            response.await.assert_status_ok().json();

        assert!(track_occupancies.is_empty());
    }

    #[test]
    fn unknown_op_without_local_track_name_has_null_reference() {
        let op_ref = OperationalPointReference::Domestic {
            country_code: "UNKNOWN".into(),
            main_code: "UNKNOWN".into(),
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
                ..Default::default()
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
        let op_ref = OperationalPointReference::Domestic {
            country_code: "UNKNOWN".into(),
            main_code: "UNKNOWN".into(),
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
                ..Default::default()
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
        let op_ref = OperationalPointReference::Domestic {
            country_code: "UNKNOWN".into(),
            main_code: "UNKNOWN".into(),
            secondary_code: None,
        };
        let start_time = ms_since_epoch("2026-01-01T00:00:00Z");
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
                ..Default::default()
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
            response.await.assert_status_ok().json();
        assert!(!track_occupancies.is_empty());
    }
}
