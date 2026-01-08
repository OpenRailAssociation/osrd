use database::DbConnection;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::QueryableByName;
use editoast_derive::Model;
use itertools::Itertools;

use crate::pagination::load_for_pagination;

use crate as editoast_models;

#[derive(Clone, Debug, Model)]
#[model(row(derive(QueryableByName)))]
#[model(table = database::tables::paced_train_round_trips)]
#[model(gen(batch_ops = c))]
pub struct PacedTrainRoundTrips {
    pub id: i64,
    /// First ID of the paced train of this round trip
    pub left_id: i64,
    /// Paced train ID of the paced train of this round trip
    /// This is `None` for one-way trains
    pub right_id: Option<i64>,
}

impl PacedTrainRoundTrips {
    #[tracing::instrument(
        name = "list_paginated<PacedTrainRoundTrips>",
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
        use database::tables::paced_train;
        use database::tables::paced_train_round_trips;

        let query = paced_train_round_trips::table
            .inner_join(paced_train::table)
            .select(paced_train_round_trips::all_columns)
            .filter(paced_train::dsl::timetable_id.eq(timetable_id))
            .order_by(paced_train_round_trips::id.asc());

        let (results, count): (Vec<PacedTrainRoundTripsRow>, _) =
            load_for_pagination(conn, query, page, page_size).await?;
        Ok((results.into_iter().map_into().collect(), count))
    }

    /// Deletes a batch of paced train round trips given a list of paced train IDs
    ///
    /// **IMPORTANT**: This function does not take ids of round trips, but rather the IDs of the paced trains
    #[tracing::instrument(
        name = "delete_batch_train_ids<PacedTrainRoundTrips>",
        skip_all,
        err,
        fields(paced_train_ids)
    )]
    pub async fn delete_batch_train_ids<I: IntoIterator<Item = i64> + Send>(
        conn: &mut DbConnection,
        paced_train_ids: I,
    ) -> Result<usize, database::DatabaseError> {
        use database::tables::paced_train_round_trips::dsl;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;
        use std::ops::DerefMut;

        let ids = paced_train_ids.into_iter().collect::<Vec<_>>();
        let nb = diesel::delete(
            database::tables::paced_train_round_trips::table
                .filter(dsl::left_id.eq_any(&ids).or(dsl::right_id.eq_any(&ids))),
        )
        .execute(conn.write().await.deref_mut())
        .await?;
        Ok(nb)
    }
}
