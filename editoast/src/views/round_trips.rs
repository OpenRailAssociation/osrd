use crate::error::Result;
use crate::models;
use crate::models::Model;
use crate::models::TrainScheduleRoundTrips;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::timetable::TimetableIdParam;
use authz;
use axum::Extension;
use axum::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use diesel_async::scoped_futures::ScopedFutureExt;
use models::CreateBatch;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashSet;
use utoipa::ToSchema;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;

editoast_common::schemas! {
    RoundTrips,
}

/// Represents a collection of round trips and one-way
#[derive(Debug, Default, Clone, Deserialize, Serialize, ToSchema)]
pub(in crate::views) struct RoundTrips {
    /// List of one-way trains
    #[serde(default)]
    one_ways: Vec<i64>,
    /// List of round trips, each represented by a tuple
    #[serde(default)]
    #[schema(schema_with = schema_round_trips)]
    round_trips: Vec<(i64, i64)>,
}

// We need to implement `ToSchema` manually to handle tuple arity correctly
fn schema_round_trips() -> RefOr<Schema> {
    utoipa::openapi::schema::ArrayBuilder::new()
        .items(
            utoipa::openapi::schema::ArrayBuilder::new()
                .items(
                    utoipa::openapi::ObjectBuilder::new()
                        .schema_type(utoipa::openapi::SchemaType::Integer)
                        .format(Some(utoipa::openapi::SchemaFormat::KnownFormat(
                            utoipa::openapi::KnownFormat::Int64,
                        )))
                        .minimum(Some(0f64)),
                )
                .min_items(Some(2))
                .max_items(Some(2)),
        )
        .description(Some("List of round trips, each represented by a tuple"))
        .into()
}

/// Upsert a list of round trips / one-way of train schedules
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body = RoundTrips,
    responses((status = 204, description = "Round trips were successfully upserted"))
)]
pub(in crate::views) async fn post_train_schedules(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(round_trips): Json<RoundTrips>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let to_remove = round_trips
        .one_ways
        .iter()
        .copied()
        .chain(round_trips.round_trips.iter().flat_map(|(l, r)| [*l, *r]));
    let round_trips_changesets = round_trips
        .round_trips
        .iter()
        .map(|(l, r)| {
            TrainScheduleRoundTrips::changeset()
                .left_id(*l)
                .right_id(Some(*r))
        })
        .chain(
            round_trips
                .one_ways
                .iter()
                .map(|id| TrainScheduleRoundTrips::changeset().left_id(*id)),
        );

    db_pool
        .get()
        .await?
        .transaction::<_, crate::error::InternalError, _>(|mut conn| {
            async move {
                TrainScheduleRoundTrips::delete_batch_train_ids(&mut conn, to_remove).await?;
                TrainScheduleRoundTrips::create_batch::<_, Vec<_>>(
                    &mut conn,
                    round_trips_changesets,
                )
                .await?;
                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Upsert a list of round trips / one-way of paced trains
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body = RoundTrips,
    responses((status = 204, description = "Round trips were successfully upserted"))
)]
pub(in crate::views) async fn post_paced_trains() -> Result<impl IntoResponse> {
    // TODO: Implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Delete a list of round trips / one-way of train schedules
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body(
        content = Vec<i64>,
        description = "IDs of train schedules to remove from round trips or one-way."
    ),
    responses((status = 204, description = "Round trips were successfully deleted"))
)]
pub(in crate::views) async fn delete_train_schedules(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(train_schedule_ids): Json<HashSet<i64>>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    TrainScheduleRoundTrips::delete_batch_train_ids(conn, train_schedule_ids).await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Delete a list of round trips / one-way of paced trains
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body(
        content = Vec<u64>,
        description = "IDs of paced trains to remove from round trips or one-way."
    ),
    responses((status = 204, description = "Round trips were successfully deleted"))
)]
pub(in crate::views) async fn delete_paced_trains() -> Result<impl IntoResponse> {
    // TODO: Implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Paginated list of round trips / one-way
#[derive(Serialize, ToSchema)]
pub(in crate::views) struct RoundTripsPage {
    #[serde(flatten)]
    stats: PaginationStats,
    results: RoundTrips,
}

/// Upsert a list of round trips / one-way of train schedules
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable,round_trips",
    params(TimetableIdParam, PaginationQueryParams<1000>),
    responses((status = 200, body = inline(RoundTripsPage)))
)]
pub(in crate::views) async fn list_train_schedules(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<1000>>,
) -> Result<Json<RoundTripsPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let (round_trips, stats) =
        TrainScheduleRoundTrips::list_paginated(conn, timetable_id, page, page_size).await?;

    let results = round_trips
        .into_iter()
        .fold(RoundTrips::default(), |mut acc, rt| {
            if let Some(right_id) = rt.right_id {
                acc.round_trips.push((rt.left_id, right_id));
            } else {
                acc.one_ways.push(rt.left_id);
            }
            acc
        });

    Ok(Json(RoundTripsPage { results, stats }))
}

/// Upsert a list of round trips / one-way of paced trains
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable,round_trips",
    params(TimetableIdParam, PaginationQueryParams<1000>),
    responses((status = 200, body = inline(RoundTripsPage)))
)]
pub(in crate::views) async fn list_paced_trains(
    Path(TimetableIdParam { id: _ }): Path<TimetableIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<1000>>,
) -> Result<Json<RoundTripsPage>> {
    // TODO: Implement this endpoint
    Ok(Json(RoundTripsPage {
        stats: PaginationStats::new(0, 0, page, page_size),
        results: RoundTrips::default(),
    }))
}
