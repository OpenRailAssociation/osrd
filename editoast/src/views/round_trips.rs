use crate::error::Result;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::timetable::TimetableIdParam;
use authz;
use axum::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use itertools::Itertools;
use models::prelude::*;
use models::round_trips::TrainScheduleRoundTrips;
use models::timetable::Timetable;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use utoipa::ToSchema;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;

#[derive(Debug, thiserror::Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "round_trips")]
enum RoundTripsError {
    #[error("Timetable '{timetable_id}' not found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },

    #[error("The payload contains duplicate train IDs which is not allowed")]
    #[editoast_error(status = 400)]
    DuplicateTrainIds,

    #[error("Database error")]
    #[editoast_error(status = 500)]
    #[from(forward)]
    Database(models::Error),
}

/// Represents a collection of round trips and one-way
#[derive(Debug, Default, Clone, Deserialize, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
pub(in crate::views) struct RoundTrips {
    /// List of one-way trains
    #[serde(default)]
    one_ways: Vec<i64>,
    /// List of round trips, each represented by a tuple
    #[serde(default)]
    #[schema(schema_with = schema_round_trips)]
    round_trips: Vec<(i64, i64)>,
}

impl RoundTrips {
    /// Check if it contains duplicate ids in both one-ways and round trips
    fn has_duplicates(&self) -> bool {
        // Using sort and dedup is faster than using a HashSet
        let nb_ids = self.one_ways.len() + self.round_trips.len() * 2;
        let mut ids = Vec::with_capacity(nb_ids);
        ids.extend(self.one_ways.iter().copied());
        ids.extend(self.round_trips.iter().flat_map(|&(l, r)| [l, r]));
        ids.sort_unstable();
        let dedup_count = ids.iter().dedup().count();
        dedup_count != nb_ids
    }
}

// We need to implement `ToSchema` manually to handle tuple arity correctly
fn schema_round_trips() -> RefOr<Schema> {
    utoipa::openapi::schema::ArrayBuilder::new()
        .items(
            utoipa::openapi::schema::ArrayBuilder::new()
                .items(
                    utoipa::openapi::ObjectBuilder::new()
                        .schema_type(utoipa::openapi::schema::SchemaType::Type(
                            utoipa::openapi::schema::Type::Integer,
                        ))
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
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body = RoundTrips,
    responses((status = 204, description = "Round trips were successfully upserted"))
)]
pub(in crate::views) async fn upsert(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(round_trips): Json<RoundTrips>,
) -> Result<impl IntoResponse> {
    if round_trips.has_duplicates() {
        return Err(RoundTripsError::DuplicateTrainIds.into());
    }

    let to_remove = round_trips
        .one_ways
        .iter()
        .copied()
        .chain(round_trips.round_trips.iter().flat_map(|&(l, r)| [l, r]));
    let round_trips_changesets = round_trips
        .round_trips
        .iter()
        .map(|&(l, r)| {
            TrainScheduleRoundTrips::changeset()
                .left_id(l.min(r))
                .right_id(Some(l.max(r)))
        })
        .chain(
            round_trips
                .one_ways
                .iter()
                .map(|&id| TrainScheduleRoundTrips::changeset().left_id(id)),
        );

    db_pool
        .get()
        .await?
        .transaction::<_, crate::error::InternalError, _, _>(async move |mut conn| {
            TrainScheduleRoundTrips::delete_batch_train_ids(&mut conn, to_remove).await?;
            TrainScheduleRoundTrips::create_batch::<_, Vec<_>>(&mut conn, round_trips_changesets)
                .await?;
            Ok(())
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Delete a list of round trips / one-way of train schedules
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "round_trips",
    request_body(
        content = Vec<i64>,
        description = "IDs of train schedules to remove from round trips or one-way."
    ),
    responses((status = 204, description = "Round trips were successfully deleted"))
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(train_schedule_ids): Json<HashSet<i64>>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;
    TrainScheduleRoundTrips::delete_batch_train_ids(conn, train_schedule_ids).await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Paginated list of round trips / one-way
#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
pub(in crate::views) struct RoundTripsPage {
    #[serde(flatten)]
    stats: PaginationStats,
    results: RoundTrips,
}

/// Paginated list of round trips / one-way of train schedules
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tags = ["timetable", "round_trips"],
    params(TimetableIdParam, PaginationQueryParams<1000>),
    responses((status = 200, body = inline(RoundTripsPage), description = "The paginated list of round trips / one-ways"))
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<1000>>,
) -> Result<Json<RoundTripsPage>> {
    let conn = &mut db_pool.get().await?;

    Timetable::exists_or_fail(conn, timetable_id, || RoundTripsError::TimetableNotFound {
        timetable_id,
    })
    .await?;

    let (round_trips, count) =
        TrainScheduleRoundTrips::list_paginated(conn, timetable_id, page, page_size).await?;
    let stats = PaginationStats::new(round_trips.len() as u64, count, page, page_size);

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

#[cfg(test)]
mod tests {
    use super::*;

    use database::DbConnection;
    use pretty_assertions::assert_eq;
    use reqwest::StatusCode;

    use crate::fixtures::create_simple_paced_train;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;

    async fn create_dummy_schedules(
        conn: &mut DbConnection,
        train_schedule_set_id: i64,
        count: usize,
    ) -> Vec<models::TrainSchedule> {
        let mut train_schedules = Vec::with_capacity(count);
        for _ in 0..count {
            train_schedules.push(create_simple_paced_train(conn, train_schedule_set_id).await);
        }
        train_schedules
    }

    async fn retrieve_round_trips(
        conn: &mut DbConnection,
        train_schedule_ids: impl IntoIterator<Item = i64> + Send,
    ) -> HashSet<(i64, Option<i64>)> {
        TrainScheduleRoundTrips::retrieve_from_train_schedule_ids(conn, train_schedule_ids)
            .await
            .expect("Failed to retrieve round trips")
            .into_iter()
            .map(|round_trip| (round_trip.left_id, round_trip.right_id))
            .collect()
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn upsert_round_trips() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app
            .user("user", "User")
            .with_roles([authz::Role::OperationalStudies])
            .create()
            .await;
        let (_, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let train_schedules =
            create_dummy_schedules(&mut db_pool.get_ok(), train_schedule_set.id, 4).await;
        let train_ids = train_schedules
            .iter()
            .map(|train_schedule| train_schedule.id)
            .collect::<Vec<_>>();

        app.post("/round_trips/")
            .by_user(user.as_ref())
            .json(&RoundTrips {
                one_ways: vec![train_ids[0]],
                round_trips: vec![(train_ids[1], train_ids[2])],
            })
            .await
            .assert_status(StatusCode::NO_CONTENT);

        assert_eq!(
            retrieve_round_trips(&mut db_pool.get_ok(), train_ids.clone()).await,
            HashSet::from([(train_ids[0], None), (train_ids[1], Some(train_ids[2]))])
        );

        app.post("/round_trips/")
            .by_user(user.as_ref())
            .json(&RoundTrips {
                one_ways: vec![train_ids[1]],
                round_trips: vec![(train_ids[3], train_ids[0])],
            })
            .await
            .assert_status(StatusCode::NO_CONTENT);

        assert!(train_ids[3] > train_ids[0]);
        assert_eq!(
            retrieve_round_trips(&mut db_pool.get_ok(), train_ids.clone()).await,
            HashSet::from([(train_ids[1], None), (train_ids[0], Some(train_ids[3]))]) // round trips are ordered by id
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_round_trips() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app
            .user("user", "User")
            .with_roles([authz::Role::OperationalStudies])
            .create()
            .await;
        let (_, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let train_schedules =
            create_dummy_schedules(&mut db_pool.get_ok(), train_schedule_set.id, 5).await;
        let train_ids = train_schedules
            .iter()
            .map(|train_schedule| train_schedule.id)
            .collect::<Vec<_>>();

        TrainScheduleRoundTrips::create_batch::<_, Vec<_>>(
            &mut db_pool.get_ok(),
            [
                TrainScheduleRoundTrips::changeset()
                    .left_id(train_ids[0])
                    .right_id(Some(train_ids[1])),
                TrainScheduleRoundTrips::changeset().left_id(train_ids[2]),
                TrainScheduleRoundTrips::changeset()
                    .left_id(train_ids[3])
                    .right_id(Some(train_ids[4])),
            ],
        )
        .await
        .expect("Failed to create round trips");

        app.post("/round_trips/delete")
            .by_user(user.as_ref())
            .json(&[train_ids[1], train_ids[2]])
            .await
            .assert_status(StatusCode::NO_CONTENT);

        assert_eq!(
            retrieve_round_trips(&mut db_pool.get_ok(), train_ids.clone()).await,
            HashSet::from([(train_ids[3], Some(train_ids[4]))])
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_round_trips_paginated() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app
            .user("user", "User")
            .with_roles([authz::Role::OperationalStudies])
            .create()
            .await;
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let train_schedules =
            create_dummy_schedules(&mut db_pool.get_ok(), train_schedule_set.id, 6).await;
        let train_ids = train_schedules
            .iter()
            .map(|train_schedule| train_schedule.id)
            .collect::<Vec<_>>();

        TrainScheduleRoundTrips::create_batch::<_, Vec<_>>(
            &mut db_pool.get_ok(),
            [
                TrainScheduleRoundTrips::changeset().left_id(train_ids[0]),
                TrainScheduleRoundTrips::changeset()
                    .left_id(train_ids[1])
                    .right_id(Some(train_ids[2])),
                TrainScheduleRoundTrips::changeset().left_id(train_ids[3]),
                TrainScheduleRoundTrips::changeset()
                    .left_id(train_ids[4])
                    .right_id(Some(train_ids[5])),
            ],
        )
        .await
        .expect("Failed to create round trips");

        let (_, other_train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let other_train_schedule =
            create_simple_paced_train(&mut db_pool.get_ok(), other_train_schedule_set.id).await;
        TrainScheduleRoundTrips::create_batch::<_, Vec<_>>(
            &mut db_pool.get_ok(),
            [TrainScheduleRoundTrips::changeset().left_id(other_train_schedule.id)],
        )
        .await
        .expect("Failed to create round trip for another timetable");

        let first_page: RoundTripsPage = app
            .get(&format!("/timetable/{}/round_trips", timetable.id))
            .by_user(user.as_ref())
            .add_query_param("page", 1)
            .add_query_param("page_size", 2)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            first_page,
            RoundTripsPage {
                stats: PaginationStats {
                    count: 4,
                    page_size: 2,
                    page_count: 2,
                    current: 1,
                    previous: None,
                    next: Some(2),
                },
                results: RoundTrips {
                    one_ways: vec![train_ids[0]],
                    round_trips: vec![(train_ids[1], train_ids[2])],
                },
            }
        );

        let second_page: RoundTripsPage = app
            .get(&format!("/timetable/{}/round_trips", timetable.id))
            .by_user(user.as_ref())
            .add_query_param("page", 2)
            .add_query_param("page_size", 2)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            second_page,
            RoundTripsPage {
                stats: PaginationStats {
                    count: 4,
                    page_size: 2,
                    page_count: 2,
                    current: 2,
                    previous: Some(1),
                    next: None,
                },
                results: RoundTrips {
                    one_ways: vec![train_ids[3]],
                    round_trips: vec![(train_ids[4], train_ids[5])],
                },
            }
        );
    }

    #[test]
    fn test_round_trips_duplicates() {
        let round_trips = RoundTrips {
            one_ways: (1..10_000).collect(),
            round_trips: (10_000..20_000).step_by(2).map(|i| (i, i + 1)).collect(),
        };
        assert!(!round_trips.has_duplicates());

        let round_trips_with_duplicates = RoundTrips {
            one_ways: (1..10_000).chain(std::iter::once(424)).collect(),
            round_trips: (10_000..20_000).step_by(2).map(|i| (i, i + 1)).collect(),
        };
        assert!(round_trips_with_duplicates.has_duplicates());

        let round_trips_with_duplicates = RoundTrips {
            one_ways: (1..10_000).collect(),
            round_trips: (10_000..20_000)
                .step_by(2)
                .chain(std::iter::once(424))
                .map(|i| (i, i + 1))
                .collect(),
        };
        assert!(round_trips_with_duplicates.has_duplicates());
    }
}
