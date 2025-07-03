use crate::error::Result;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::timetable::TimetableIdParam;
use axum::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::response::IntoResponse;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;

crate::routes! {
    "/round_trips" => {
        "/train_schedules" => {
            post_train_schedules,
            "/delete" => delete_train_schedules,
        },
        "/paced_trains" => {
            post_paced_trains,
            "/delete" => delete_paced_trains,
        },
    },
}

pub(in crate::views) mod timetable_routes {
    use super::*;

    crate::routes! {
        "/round_trips" => {
            "/train_schedules" => list_train_schedules,
            "/paced_trains" => list_paced_trains,
        },
    }
}

editoast_common::schemas! {
    RoundTrips,
}

/// Represents a collection of round trips and one-way
#[derive(Debug, Default, Clone, Deserialize, Serialize, ToSchema)]
struct RoundTrips {
    /// List of one-way trains
    #[serde(default)]
    one_ways: Vec<u64>,
    /// List of round trips, each represented by a tuple
    #[serde(default)]
    #[schema(schema_with = schema_round_trips)]
    round_trips: Vec<(u64, u64)>,
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
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body = RoundTrips,
    responses((status = 204, description = "Round trips were successfully upserted"))
)]
async fn post_train_schedules() -> Result<impl IntoResponse> {
    // TODO: Implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Upsert a list of round trips / one-way of paced trains
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body = RoundTrips,
    responses((status = 204, description = "Round trips were successfully upserted"))
)]
async fn post_paced_trains() -> Result<impl IntoResponse> {
    // TODO: Implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Delete a list of round trips / one-way of train schedules
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body(
        content = Vec<u64>,
        description = "IDs of train schedules to remove from round trips or one-way."
    ),
    responses((status = 204, description = "Round trips were successfully deleted"))
)]
async fn delete_train_schedules() -> Result<impl IntoResponse> {
    // TODO: Implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Delete a list of round trips / one-way of paced trains
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body(
        content = Vec<u64>,
        description = "IDs of paced trains to remove from round trips or one-way."
    ),
    responses((status = 204, description = "Round trips were successfully deleted"))
)]
async fn delete_paced_trains() -> Result<impl IntoResponse> {
    // TODO: Implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Paginated list of round trips / one-way
#[derive(Serialize, ToSchema)]
struct ListRoundTripsResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: RoundTrips,
}

/// Upsert a list of round trips / one-way of train schedules
#[utoipa::path(
    get, path = "",
    tag = "timetable,round_trips",
    params(TimetableIdParam, PaginationQueryParams<1000>),
    responses((status = 200, body = inline(ListRoundTripsResponse)))
)]
async fn list_train_schedules(
    Path(TimetableIdParam { id: _ }): Path<TimetableIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<1000>>,
) -> Result<Json<ListRoundTripsResponse>> {
    // TODO: Implement this endpoint
    Ok(Json(ListRoundTripsResponse {
        stats: PaginationStats::new(0, 0, page, page_size),
        results: RoundTrips::default(),
    }))
}

/// Upsert a list of round trips / one-way of paced trains
#[utoipa::path(
    get, path = "",
    tag = "timetable,round_trips",
    params(TimetableIdParam, PaginationQueryParams<1000>),
    responses((status = 200, body = inline(ListRoundTripsResponse)))
)]
async fn list_paced_trains(
    Path(TimetableIdParam { id: _ }): Path<TimetableIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<1000>>,
) -> Result<Json<ListRoundTripsResponse>> {
    // TODO: Implement this endpoint
    Ok(Json(ListRoundTripsResponse {
        stats: PaginationStats::new(0, 0, page, page_size),
        results: RoundTrips::default(),
    }))
}
