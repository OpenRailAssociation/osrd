use database::DbConnection;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::QueryableByName;
use editoast_derive::Model;
use itertools::Itertools;

use crate::pagination::load_for_pagination;

#[derive(Clone, Debug, Model)]
#[model(row(derive(QueryableByName)))]
#[model(table = database::tables::train_schedule_round_trips)]
#[model(gen(batch_ops = cd))]
pub struct TrainScheduleRoundTrips {
    pub id: i64,
    /// ID of the first train schedule of this round trip
    pub left_id: i64,
    /// ID of the second train schedule of this round trip
    /// This is `None` for one-way trains
    pub right_id: Option<i64>,
}

impl TrainScheduleRoundTrips {
    #[tracing::instrument(
        name = "list_paginated<TrainScheduleRoundTrips>",
        skip_all,
        err,
        fields(timetable_id, limit, offset)
    )]
    pub async fn list_paginated(
        conn: &mut DbConnection,
        timetable_id: i64,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<Self>, u64), database::DatabaseError> {
        use database::tables::timetable_train_schedule_set;
        use database::tables::train_schedule;
        use database::tables::train_schedule_round_trips;

        let query = train_schedule_round_trips::table
            .inner_join(train_schedule::table)
            .select(train_schedule_round_trips::all_columns)
            .filter(
                train_schedule::dsl::train_schedule_set_id.eq_any(
                    timetable_train_schedule_set::dsl::timetable_train_schedule_set
                        .select(timetable_train_schedule_set::dsl::train_schedule_set_id)
                        .filter(timetable_train_schedule_set::dsl::timetable_id.eq(timetable_id)),
                ),
            )
            .order_by(train_schedule_round_trips::id.asc());

        let (results, count): (Vec<TrainScheduleRoundTripsRow>, _) =
            load_for_pagination(conn, query, page, page_size).await?;
        Ok((results.into_iter().map_into().collect(), count))
    }

    /// Deletes a batch of train schedule round trips given a list of train schedule IDs
    ///
    /// **IMPORTANT**: This function does not take ids of round trips, but rather the IDs of the train schedules
    #[tracing::instrument(
        name = "delete_batch_train_ids<TrainScheduleRoundTrips>",
        skip_all,
        err,
        fields(train_schedule_ids)
    )]
    pub async fn delete_batch_train_ids<I: IntoIterator<Item = i64> + Send>(
        conn: &mut DbConnection,
        train_schedule_ids: I,
    ) -> Result<usize, database::DatabaseError> {
        use database::tables::train_schedule_round_trips::dsl;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;
        use std::ops::DerefMut;

        let ids = train_schedule_ids.into_iter().collect_vec();
        let nb = diesel::delete(
            database::tables::train_schedule_round_trips::table
                .filter(dsl::left_id.eq_any(&ids).or(dsl::right_id.eq_any(&ids))),
        )
        .execute(conn.write().await.deref_mut())
        .await?;
        Ok(nb)
    }

    /// Retrieves a batch of train schedule round trips given a list of train schedule IDs
    ///
    /// **IMPORTANT**: This function does not take ids of round trips, but rather the IDs of the train schedules
    pub async fn retrieve_from_train_schedule_ids<I: IntoIterator<Item = i64> + Send>(
        conn: &mut DbConnection,
        train_schedule_ids: I,
    ) -> Result<Vec<Self>, database::DatabaseError> {
        use database::tables::train_schedule_round_trips::dsl;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;
        use std::ops::DerefMut;

        let ids = train_schedule_ids.into_iter().collect_vec();
        let results = database::tables::train_schedule_round_trips::table
            .filter(dsl::left_id.eq_any(&ids).or(dsl::right_id.eq_any(&ids)))
            .load::<TrainScheduleRoundTripsRow>(conn.write().await.deref_mut())
            .await?;
        Ok(results.into_iter().map_into().collect())
    }
}
