use authz::v2;
use std::collections::HashMap;
use std::collections::HashSet;

use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use editoast_derive::EditoastError;
use itertools::Itertools;
use models::Infra;
use models::prelude::*;
use profile_connection_scan::Connection;
use schemas::timetable_type::TimetableType;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use tokio::task::JoinSet;
use tokio_stream::StreamExt as _;
use tokio_stream::wrappers::JoinSetStream;
use tracing::Instrument as _;
use utoipa::ToSchema;

use crate::AppState;
use crate::authentication;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::timetable::conflicts::retrieve_trains;

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "search_journeys")]
enum Error {
    #[error("Infra '{infra_id}' could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] models::Error),

    #[error("invalid input: {message}")]
    #[editoast_error(status = 400)]
    InvalidInput { message: &'static str },
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub(in crate::views) struct JourneySearchQuery {
    infra_id: i64,

    /// Until daily patterns are supported, timetables must be calendar anchored on 1970-01-01 UTC.
    timetable_ids: HashSet<i64>,

    /// Amount of milliseconds from 1970-01-01 00:00:00 UTC to the center of the start window.
    ///
    /// The start window is defined as the time between
    /// `start_sec - start_tolerance` and `start_sec + start_tolerance`.
    start_ms: u32,

    /// Half the time of the start window in milliseconds.
    ///
    /// The start window is defined as the time between
    /// `start_sec - start_tolerance` and `start_sec + start_tolerance`.
    start_tolerance: u32,

    origin: OperationalPointPartReference,
    destination: OperationalPointPartReference,

    /// Constant time for a transfer/footpath in the same stop in milliseconds.
    ///
    /// The algorithm assumes that changing from one train to another in a stop
    /// always take this constant time.
    transfer_ms: u32,
}

/// A step of the train schedule's path, with its identity and schedule.
#[derive(Debug, Clone, Serialize, ToSchema)]
struct TrainSchedulePartBound {
    /// Index of the path step in the train schedule's path
    path_step_index: usize,

    /// Id of the operational point of the corresponding step in the train schedule's path.
    op_id: String,

    /// Scheduled time of the step in milliseconds from 1970-01-01 00:00:00 UTC.
    time_ms: u32,
}

/// A part of a train schedule, from one step of its path to another.
#[derive(Debug, Clone, Serialize, ToSchema)]
struct TrainSchedulePart {
    train_schedule_id: i64,

    /// Path step of the train_schedule where the part begins
    from: TrainSchedulePartBound,

    /// Path step of the train_schedule where the part ends
    to: TrainSchedulePartBound,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub(in crate::views) struct JourneyProposals {
    /// Each journey is a list of train schedule parts.
    journeys: Vec<Vec<TrainSchedulePart>>,
}

/// A step of a train schedule's path that can be used in a connection
#[derive(Clone, Copy)]
struct ScheduleStep {
    /// Index of the step in path.
    path_index: usize,

    /// Index of the operational point the step is located at.
    op_index: usize,

    /// Time of arrival at the path step
    arrival_ms: u32,

    /// Time of departure from the path step
    departure_ms: u32,
}

/// A connection, along with the path steps it was built from.
#[derive(Clone, Copy)]
struct PathIndexedConnection {
    connection: Connection,

    /// Index in the train schedule's path of the connection departure.
    departure_path_index: usize,

    /// Index in the train schedule's path of the connection arrival.
    arrival_path_index: usize,
}

/// Search possible journeys from A to B using train parts from the given timetables.
///
/// The trains are not simulated, meaning each stop needs to be dated in order
/// to be taken into account.
/// Until daily patterns are supported, timetables must be calendar anchored on 1970-01-01 UTC.
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "search_journeys",
    request_body = JourneySearchQuery,
    responses(
        (status = 200, description = "A list of journey proposals that match the input search query", body = JourneyProposals),
    ),
)]
pub(in crate::views) async fn search_journeys(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(JourneySearchQuery {
        infra_id,
        timetable_ids,
        start_ms,
        start_tolerance,
        origin,
        destination,
        transfer_ms,
    }): Json<JourneySearchQuery>,
) -> Result<Json<JourneyProposals>> {
    let mut train_schedule_futs = JoinSet::new();

    for timetable_id in timetable_ids {
        let db_pool = db_pool.clone();

        let span = tracing::info_span!("fetching train schedules", timetable_id);

        train_schedule_futs.spawn(
            async move {
                let conn = db_pool.get().await?;
                let (timetable_type, train_schedules) = retrieve_trains(conn, timetable_id).await?;

                if timetable_type != TimetableType::Calendar {
                    Err(Error::InvalidInput {
                        message: "only calendar timetables are supported",
                    })?;
                }

                Ok::<_, InternalError>(train_schedules)
            }
            .instrument(span),
        );
    }

    let mut conn = db_pool.get().await?;

    Infra::exists_or_fail(&mut conn, infra_id, || Error::InfraNotFound { infra_id }).await?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        v2::infra_privileges(*user, authz::Infra(infra_id))
            .map(async |privileges| privileges.contains(&authz::InfraPrivilege::CanRestrictedRead))
            .ok_or(AuthorizationError::Forbidden)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await??;
    }

    let train_schedules: Vec<_> = JoinSetStream::new(train_schedule_futs)
        // Converts `Result<Result<_, InternalError>, JoinError>` into `Result<_, InternalError>`
        .map(|fut| fut?)
        .collect::<Result<Vec<_>>>()
        .await?
        .into_iter()
        .flatten()
        .collect();

    let op_references: Vec<&OperationalPointPartReference> = train_schedules
        .iter()
        .flat_map(|train_schedule| &train_schedule.path)
        .filter_map(|path_item| match &path_item.location {
            PathItemLocation::OperationalPointPartReference(op_ref) => Some(op_ref),
            // We ignore track offsets as we can't do connections on them
            PathItemLocation::TrackOffset(_) => None,
        })
        .chain([&origin, &destination])
        .unique_by(|op_ref| &op_ref.operational_point)
        .collect();

    let path_items: Vec<PathItemLocation> = op_references
        .iter()
        .map(|op_ref| PathItemLocation::OperationalPointPartReference((*op_ref).clone()))
        .collect();

    let op_cache = OperationalPointCache::load_path_items(conn, infra_id, &path_items).await?;

    let op_ids: Vec<String> = op_references
        .iter()
        .filter_map(|op_ref| op_cache.get_op_ref_id(&op_ref.operational_point))
        .unique()
        .collect();

    let op_index_by_id: HashMap<String, usize> = op_ids
        .iter()
        .cloned()
        .enumerate()
        .map(|(index, op_id)| (op_id, index))
        .collect();

    let Some(origin_index) = find_op_index(&op_cache, &op_index_by_id, &origin.operational_point)
    else {
        return Err(Error::InvalidInput {
            message: "origin not found in the infra",
        })?;
    };

    let Some(destination_index) =
        find_op_index(&op_cache, &op_index_by_id, &destination.operational_point)
    else {
        return Err(Error::InvalidInput {
            message: "destination not found in the infra",
        })?;
    };

    let journeys = tokio::task::spawn_blocking(move || {
        let train_schedule_ids: Vec<i64> = train_schedules
            .iter()
            .map(|train_schedule| train_schedule.id)
            .collect();

        let mut path_indexed_connections: Vec<PathIndexedConnection> = train_schedules
            .into_iter()
            .enumerate()
            .flat_map(|(train_schedule_index, train_schedule)| {
                // Timetables are only Calendar so we can use the raw start_time
                let offset_ms = common::units::millisecond::i64::from(train_schedule.start_time);

                // avoid moving them into the filter_map closure
                let op_index_by_id = &op_index_by_id;
                let op_cache = &op_cache;

                train_schedule
                    .path
                    .into_iter()
                    .enumerate()
                    .filter_map(move |(i, path_item)| {
                        let arrival_ms: i64;
                        let stop_for_ms: i64;

                        if i == 0 {
                            arrival_ms = offset_ms;
                            stop_for_ms = 0;
                        } else {
                            let schedule_item = train_schedule
                                .schedule
                                .iter()
                                .find(|schedule_item| schedule_item.at == path_item.id)?;

                            arrival_ms = offset_ms + schedule_item.arrival?.num_milliseconds();
                            stop_for_ms = schedule_item.stop_for?.num_milliseconds();
                        }

                        let PathItemLocation::OperationalPointPartReference(op_ref) =
                            path_item.location
                        else {
                            return None;
                        };

                        let op_index =
                            find_op_index(op_cache, op_index_by_id, &op_ref.operational_point)?;

                        // Timetables must be anchored on 1970-01-01 so arrival_ms and departure_ms
                        // overflow u32 only for schedules absurdly far in the future.
                        // We drop the step rather than failing the whole request.
                        Some(ScheduleStep {
                            path_index: i,
                            op_index,
                            arrival_ms: u32::try_from(arrival_ms).ok()?,
                            departure_ms: u32::try_from(arrival_ms + stop_for_ms).ok()?,
                        })
                    })
                    .tuple_windows()
                    .map(move |(departure, arrival)| PathIndexedConnection {
                        connection: Connection {
                            trip: train_schedule_index,
                            departure: departure.op_index,
                            departure_ms: departure.departure_ms,
                            arrival: arrival.op_index,
                            arrival_ms: arrival.arrival_ms,
                        },
                        departure_path_index: departure.path_index,
                        arrival_path_index: arrival.path_index,
                    })
                    .filter(|path_indexed_connection| {
                        // Simple filters to reduce the size of the problem.

                        // The connection isn't too early for the traveler to take it
                        let departs_late_enough = (start_ms as i64 - start_tolerance as i64)
                            <= path_indexed_connection.connection.departure_ms as i64;

                        // If the connection departs from the source OP, it
                        // doesn't depart too late for the traveler to take it
                        let departs_early_enough = path_indexed_connection.connection.departure
                            != origin_index
                            || path_indexed_connection.connection.departure_ms
                                <= start_ms + start_tolerance;

                        departs_early_enough && departs_late_enough
                    })
            })
            .collect();

        // Sort train connections by *decreasing* departure time.
        path_indexed_connections.sort_unstable_by(|a, b| {
            u32::cmp(&b.connection.departure_ms, &a.connection.departure_ms)
        });

        let connections = path_indexed_connections
            .iter()
            .map(|path_indexed_connection| path_indexed_connection.connection)
            .collect_vec();

        let journeys =
            profile_connection_scan::journey_list(profile_connection_scan::JourneyListParams {
                stop_count: op_ids.len(),
                trip_count: train_schedule_ids.len(),
                connections,
                start_ms,
                start_tolerance,
                start: origin_index,
                end: destination_index,
                transfer_ms,
            });

        journeys
            .into_iter()
            .map(|journey| {
                journey
                    .into_iter()
                    .map(|leg| {
                        let enter = path_indexed_connections[leg.enter_connection_id];
                        let exit = path_indexed_connections[leg.exit_connection_id];

                        TrainSchedulePart {
                            train_schedule_id: train_schedule_ids[enter.connection.trip],
                            from: TrainSchedulePartBound {
                                path_step_index: enter.departure_path_index,
                                op_id: op_ids[enter.connection.departure].clone(),
                                time_ms: enter.connection.departure_ms,
                            },
                            to: TrainSchedulePartBound {
                                path_step_index: exit.arrival_path_index,
                                op_id: op_ids[exit.connection.arrival].clone(),
                                time_ms: exit.connection.arrival_ms,
                            },
                        }
                    })
                    .collect()
            })
            .collect()
    })
    .instrument(tracing::info_span!("Building journeys"))
    .await
    .expect("Failed to build journeys");
    Ok(Json(JourneyProposals { journeys }))
}

/// Find the index of an operational point reference
fn find_op_index(
    op_cache: &OperationalPointCache,
    op_index_by_id: &HashMap<String, usize>,
    op_ref: &OperationalPointReference,
) -> Option<usize> {
    let op_ref_id = op_cache.get_op_ref_id(op_ref)?;
    op_index_by_id.get(&op_ref_id).copied()
}
