use std::collections::HashSet;

use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Timelike;
use chrono::Utc;
use editoast_derive::EditoastError;
use editoast_models::Infra;
use editoast_models::prelude::*;
use itertools::Itertools;
use profile_connection_scan::Connection;
use schemas::primitives::ObjectType;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use tokio::task::JoinSet;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::timetable::retrieve_trains;

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "search_journeys")]
enum Error {
    #[error("Infra '{infra_id}' could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),

    #[error("invalid input: {message}")]
    #[editoast_error(status = 400)]
    InvalidInput { message: &'static str },
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub(in crate::views) struct JourneySearchQuery {
    infra_id: i64,

    timetable_ids: HashSet<i64>,

    /// Amount of seconds from midnight to the center of the start window.
    start_sec: u32,

    /// Half the time of the start window.
    start_tolerance: u32,

    /// Currently two and only two path items are expected: the departure and
    /// the destination.
    path_items: [PathItemLocation; 2],
}

#[derive(Debug, Clone, Serialize, ToSchema)]
struct TrainSchedulePartBound {
    /// This location is part of the train schedule's path.
    location: PathItemLocation,

    /// Time since the start of the train schedule in milliseconds.
    ///
    /// Used to differentiate locations in case of backtracks.
    time_ms: u32,
}

/// A part of a train schedule, from one location to another.
#[derive(Debug, Clone, Serialize, ToSchema)]
struct TrainSchedulePart {
    train_schedule_id: i64,
    from: TrainSchedulePartBound,
    to: TrainSchedulePartBound,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub(in crate::views) struct JourneyProposals {
    /// Each journey is a list of train schedule parts.
    journeys: Vec<Vec<TrainSchedulePart>>,
}

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
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(JourneySearchQuery {
        infra_id,
        timetable_ids,
        start_sec,
        start_tolerance,
        path_items: [start, end],
    }): Json<JourneySearchQuery>,
) -> Result<Json<JourneyProposals>> {
    let PathItemLocation::OperationalPointPartReference(start_op) = &start else {
        return Err(Error::InvalidInput {
            message: "path_items must be operational points",
        })?;
    };

    let PathItemLocation::OperationalPointPartReference(end_op) = &end else {
        return Err(Error::InvalidInput {
            message: "path_items must be operational points",
        })?;
    };

    let start_op = &start_op.operational_point;
    let end_op = &end_op.operational_point;

    let mut train_schedule_futs = JoinSet::new();

    for timetable_id in timetable_ids {
        let db_pool = db_pool.clone();

        train_schedule_futs.spawn(async move {
            let conn = db_pool.get().await?;
            let train_schedules = retrieve_trains(conn, timetable_id).await?;

            Ok::<_, InternalError>(train_schedules)
        });
    }

    let mut conn = db_pool.get().await?;

    let infra =
        Infra::retrieve_or_fail(conn.clone(), infra_id, || Error::InfraNotFound { infra_id })
            .await?;

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let operational_point_ids = infra
        .list_objects(&mut conn, ObjectType::OperationalPoint)
        .await?;

    let path_items: Vec<PathItemLocation> = operational_point_ids
        .iter()
        .map(|operational_point| path_item_id(operational_point))
        .collect();

    let path_items: Vec<&PathItemLocation> = path_items.iter().collect();

    let op_cache = OperationalPointCache::load_path_items(conn, infra_id, &path_items).await?;

    let Some(start_op) = op_cache.get_op_ref_id(start_op) else {
        return Err(Error::InvalidInput {
            message: "path_items not found in the infra",
        })?;
    };

    let Some(end_op) = op_cache.get_op_ref_id(end_op) else {
        return Err(Error::InvalidInput {
            message: "path_items not found in the infra",
        })?;
    };

    let Some(start_index) = operational_point_ids
        .iter()
        .position(|operational_point_id| *operational_point_id == start_op)
    else {
        return Err(Error::InvalidInput {
            message: "path_items not found in the infra",
        })?;
    };

    let Some(end_index) = operational_point_ids
        .iter()
        .position(|operational_point_id| *operational_point_id == end_op)
    else {
        return Err(Error::InvalidInput {
            message: "path_items not found in the infra",
        })?;
    };

    let mut train_schedule_ids = Vec::new();
    let mut train_schedule_parts = Vec::new();
    let mut train_schedule_start_times = Vec::new();
    while let Some(ts_fut_result) = train_schedule_futs.join_next().await {
        let train_schedules = ts_fut_result??;

        let index_offset = train_schedule_ids.len();

        train_schedule_ids.extend(
            train_schedules
                .iter()
                .map(|train_schedule| train_schedule.id),
        );

        train_schedule_start_times.extend(
            train_schedules
                .iter()
                .map(|train_schedule| datetime_millis_from_midnight(train_schedule.start_time)),
        );

        train_schedule_parts.extend(train_schedules.into_iter().zip(index_offset..).flat_map(
            |(train_schedule, train_schedule_index)| {
                // TODO this handles badly train schedules that span longer than a day
                let offset_ms = datetime_millis_from_midnight(train_schedule.start_time);

                // avoid moving them into the filter_map closure
                let operational_points = operational_point_ids.as_slice();
                let op_cache = &op_cache;

                train_schedule
                    .path
                    .into_iter()
                    .enumerate()
                    .filter_map(move |(i, path_item)| {
                        let arrival_ms: u32;
                        let stop_for_ms: u32;

                        if i == 0 {
                            arrival_ms = offset_ms;
                            stop_for_ms = 0;
                        } else {
                            let schedule_item = train_schedule
                                .schedule
                                .iter()
                                .find(|schedule_item| schedule_item.at == path_item.id)?;

                            arrival_ms = offset_ms
                                + u32::try_from(schedule_item.arrival?.num_milliseconds()).unwrap();
                            stop_for_ms =
                                u32::try_from(schedule_item.stop_for?.num_milliseconds()).unwrap();
                        }

                        let PathItemLocation::OperationalPointPartReference(op_ref) =
                            path_item.location
                        else {
                            return None;
                        };

                        let op_id = op_cache.get_op_ref_id(&op_ref.operational_point)?;

                        let op_index = operational_points
                            .iter()
                            .position(|operational_point| &op_id == operational_point)?;

                        Some((op_index, arrival_ms, stop_for_ms))
                    })
                    .tuple_windows()
                    .map(
                        move |(
                            (start_op_index, start_op_arrival_ms, start_op_stop_for_ms),
                            (end_op_index, end_op_arrival_ms, _end_op_stop_for_ms),
                        )| {
                            Connection {
                                trip: train_schedule_index,
                                departure: start_op_index,
                                departure_ms: start_op_arrival_ms + start_op_stop_for_ms,
                                arrival: end_op_index,
                                arrival_ms: end_op_arrival_ms,
                            }
                        },
                    )
                    .filter(|connection| {
                        // Simple filters to reduce the size of the problem.

                        // The connection isn't too early for the traveler to take it
                        let departs_late_enough = (start_sec as i64 - start_tolerance as i64)
                            * 1000
                            <= connection.departure_ms as i64;

                        // If the connection departs from the source OP, it
                        // doesn't depart too late for the traveler to take it
                        let departs_early_enough = connection.departure != start_index
                            || connection.departure_ms <= (start_sec + start_tolerance) * 1000;

                        departs_early_enough && departs_late_enough
                    })
            },
        ));
    }

    train_schedule_parts.sort_unstable_by(|a, b| u32::cmp(&b.departure_ms, &a.departure_ms));

    let journeys = profile_connection_scan::journey_list(
        operational_point_ids.len(),
        train_schedule_ids.len(),
        train_schedule_parts,
        start_sec * 1000,
        start_tolerance * 1000,
        start_index,
        end_index,
    );

    let journeys = journeys
        .into_iter()
        .map(|journey| {
            dedup_connections(journey.into_iter())
                .map(|connection| TrainSchedulePart {
                    train_schedule_id: train_schedule_ids[connection.trip],
                    from: TrainSchedulePartBound {
                        location: path_item_id(&operational_point_ids[connection.departure]),
                        time_ms: connection.departure_ms
                            - train_schedule_start_times[connection.trip],
                    },
                    to: TrainSchedulePartBound {
                        location: path_item_id(&operational_point_ids[connection.arrival]),
                        time_ms: connection.arrival_ms
                            - train_schedule_start_times[connection.trip],
                    },
                })
                .collect()
        })
        .collect();

    Ok(Json(JourneyProposals { journeys }))
}

/// Make a [PathItemLocation] from an operational point identifier.
fn path_item_id(id: &str) -> PathItemLocation {
    PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
        operational_point: OperationalPointReference::Id {
            operational_point: id.into(),
        },
        local_track_name: None,
    })
}

/// Deduplicate connections that have the same trip in the given iterator.
fn dedup_connections<'a, I>(mut iter: I) -> impl Iterator<Item = Connection> + 'a
where
    I: Iterator<Item = Connection> + 'a,
{
    let mut prev_connection: Option<Connection> = None;

    std::iter::from_fn(move || {
        loop {
            let next_connection = match iter.next() {
                Some(conn) => conn,
                None => return prev_connection.take(),
            };

            match &mut prev_connection {
                Some(prev_conn) => {
                    if prev_conn.trip == next_connection.trip {
                        prev_conn.arrival = next_connection.arrival;
                        prev_conn.arrival_ms = next_connection.arrival_ms;
                    } else {
                        return prev_connection.replace(next_connection);
                    }
                }
                None => prev_connection = Some(next_connection),
            }
        }
    })
}

fn datetime_millis_from_midnight(t: DateTime<Utc>) -> u32 {
    ((t.hour() * 60 + t.minute()) * 60 + t.second()) * 1_000 + t.nanosecond() / 1_000_000
}
