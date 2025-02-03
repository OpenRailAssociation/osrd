use chrono::DateTime;
use chrono::Utc;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use futures_util::stream::TryStreamExt;
use std::ops::DerefMut;

use crate::error::Result;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;
use crate::models::Retrieve;
use editoast_models::DbConnection;

#[derive(Debug, Default, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = editoast_models::tables::timetable)]
#[model(gen(ops = crd, list))]
pub struct Timetable {
    pub id: i64,
}

impl From<Timetable> for Option<i64> {
    fn from(timetable: Timetable) -> Self {
        Some(timetable.id)
    }
}

impl Timetable {
    pub async fn trains_count(timetable_id: i64, conn: &mut DbConnection) -> Result<i64> {
        use editoast_models::tables::train_schedule::dsl;

        dsl::train_schedule
            .filter(dsl::timetable_id.eq(timetable_id))
            .count()
            .get_result(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    pub async fn gather_start_times(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<Vec<DateTime<Utc>>> {
        use editoast_models::tables::train_schedule::dsl;

        dsl::train_schedule
            .select(dsl::start_time)
            .filter(dsl::timetable_id.eq(timetable_id))
            .load(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    pub async fn schedules_before_date(
        self,
        conn: &mut DbConnection,
        time: DateTime<Utc>,
    ) -> Result<Vec<TrainSchedule>> {
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;
        use editoast_models::tables::train_schedule::dsl;

        let train_schedules = dsl::train_schedule
            .filter(dsl::start_time.le(time))
            .filter(dsl::timetable_id.eq(self.id))
            .load_stream::<Row<TrainSchedule>>(conn.write().await.deref_mut())
            .await?
            .map_ok(|ts| ts.into())
            .try_collect::<Vec<TrainSchedule>>()
            .await;
        match train_schedules {
            Ok(train_schedules) => Ok(train_schedules),
            Err(err) => Err(err.into()),
        }
    }
}

/// Should be used to retrieve a timetable with its trains
#[derive(Debug, Clone, QueryableByName)]
pub struct TimetableWithTrains {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Array<BigInt>)]
    pub train_ids: Vec<i64>,
}

#[async_trait::async_trait]
impl Retrieve<i64> for TimetableWithTrains {
    async fn retrieve(conn: &mut DbConnection, timetable_id: i64) -> Result<Option<Self>> {
        let result = sql_query(
            "SELECT timetable.*,
        array_remove(array_agg(train_schedule.id), NULL) as train_ids
        FROM timetable
        LEFT JOIN train_schedule ON timetable.id = train_schedule.timetable_id
        WHERE timetable.id = $1
        GROUP BY timetable.id",
        )
        .bind::<BigInt, _>(timetable_id)
        .get_result::<TimetableWithTrains>(conn.write().await.deref_mut())
        .await;
        match result {
            Ok(result) => Ok(Some(result)),
            Err(diesel::result::Error::NotFound) => Ok(None),
            Err(err) => Err(err.into()),
        }
    }
}

impl From<TimetableWithTrains> for Timetable {
    fn from(timetable_with_trains: TimetableWithTrains) -> Self {
        Self {
            id: timetable_with_trains.id,
        }
    }
}
