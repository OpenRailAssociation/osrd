use chrono::DateTime;
use chrono::Utc;
use database::DatabaseError;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Timestamptz;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use futures_util::stream::TryStreamExt;
use std::ops::DerefMut;

use crate::models::train_schedule::TrainSchedule;
use database::DbConnection;
use editoast_models::prelude::*;

#[derive(Debug, Default, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = database::tables::timetable)]
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
    pub async fn trains_count(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        use database::tables::train_schedule::dsl;

        dsl::train_schedule
            .filter(dsl::timetable_id.eq(timetable_id))
            .count()
            .get_result(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    pub async fn paced_trains_count(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        use database::tables::paced_train::dsl;

        dsl::paced_train
            .filter(dsl::timetable_id.eq(timetable_id))
            .count()
            .get_result(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    pub async fn gather_start_times(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<Vec<DateTime<Utc>>, database::DatabaseError> {
        use database::tables::train_schedule::dsl;

        dsl::train_schedule
            .select(dsl::start_time)
            .filter(dsl::timetable_id.eq(timetable_id))
            .load(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    /// This function will return all train schedules in a timetable that runs within the time window.
    ///
    /// **IMPORTANT**: The filter is based on the scheduled arrival time and not the actual simulated arrival time.
    ///
    /// The diagram below shows a list of trains in a timetable:
    /// `?`: unscheduled arrival times.
    /// `|`: scheduled arrival times.
    ///
    /// ```
    ///                       min_time               max_time
    ///     Time Window           |----------------------|
    /// Train 1 ✅         |-------------|
    /// Train 2 ❌    |-------|
    /// Train 3 ✅                              |----------|
    /// Train 4 ✅   |-------?
    /// Train 5 ✅                        |---------?
    /// Train 6 ❌                                           |------?
    /// ```
    pub async fn schedules_in_time_window(
        self,
        conn: &mut DbConnection,
        min_time: DateTime<Utc>,
        max_time: DateTime<Utc>,
    ) -> Result<Vec<TrainSchedule>, database::DatabaseError> {
        let train_schedules = sql_query(include_str!(
            "timetable/sql/get_train_schedules_in_time_window.sql"
        ))
        .bind::<BigInt, _>(self.id)
        .bind::<Timestamptz, _>(max_time)
        .bind::<Timestamptz, _>(min_time)
        .load_stream::<Row<TrainSchedule>>(conn.write().await.deref_mut())
        .await?
        .map_ok(|ts| ts.into())
        .try_collect::<Vec<TrainSchedule>>()
        .await;
        train_schedules.map_err(|e| e.into())
    }
}

/// Should be used to retrieve a timetable with its trains
#[derive(Debug, Clone, QueryableByName)]
pub struct TimetableWithTrains {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Array<BigInt>)]
    pub train_ids: Vec<i64>,
    #[diesel(sql_type = Array<BigInt>)]
    pub paced_train_ids: Vec<i64>,
}

impl TimetableWithTrains {
    pub async fn retrieve(
        conn: DbConnection,
        timetable_id: i64,
    ) -> Result<Option<Self>, DatabaseError> {
        let result = sql_query(
            "SELECT timetable.*,
        array_remove(array_agg(train_schedule.id), NULL) as train_ids,
        array_remove(array_agg(paced_train.id), NULL) as paced_train_ids
        FROM timetable
        LEFT JOIN train_schedule ON timetable.id = train_schedule.timetable_id
        LEFT JOIN paced_train ON timetable.id = paced_train.timetable_id
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

    pub async fn retrieve_or_fail<E, F>(conn: DbConnection, id: i64, fail: F) -> Result<Self, E>
    where
        E: From<DatabaseError>,
        F: FnOnce() -> E + Send,
    {
        match Self::retrieve(conn, id).await {
            Ok(Some(obj)) => Ok(obj),
            Ok(None) => Err(fail()),
            Err(e) => Err(E::from(e)),
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

#[cfg(test)]
pub mod tests {
    use chrono::Duration;
    use chrono::TimeZone;
    use chrono::Utc;
    use pretty_assertions::assert_eq;

    use std::collections::HashSet;

    use super::*;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_train_schedule_base;
    use crate::models::train_schedule::TrainScheduleChangeset;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_schedules_in_time_window() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        // Note that this train has a last arrival at PT50M
        let min_time = Utc.with_ymd_and_hms(2025, 1, 1, 12, 0, 0).unwrap();
        let max_time = Utc.with_ymd_and_hms(2025, 1, 1, 14, 0, 0).unwrap();
        let base_ts = simple_train_schedule_base();
        TrainScheduleChangeset::from(base_ts.clone())
            .timetable_id(timetable.id)
            .train_name("Train 1".into())
            .start_time(min_time - Duration::minutes(20))
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        TrainScheduleChangeset::from(base_ts.clone())
            .timetable_id(timetable.id)
            .train_name("Train 2".into())
            .start_time(min_time - Duration::hours(2))
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        TrainScheduleChangeset::from(base_ts.clone())
            .timetable_id(timetable.id)
            .train_name("Train 3".into())
            .start_time(max_time - Duration::minutes(5))
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        TrainScheduleChangeset::from(base_ts.clone())
            .timetable_id(timetable.id)
            .train_name("Train 4".into())
            .start_time(min_time - Duration::hours(2))
            .schedule(vec![])
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        TrainScheduleChangeset::from(base_ts.clone())
            .timetable_id(timetable.id)
            .train_name("Train 5".into())
            .start_time(max_time - Duration::minutes(10))
            .schedule(vec![])
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        TrainScheduleChangeset::from(base_ts.clone())
            .timetable_id(timetable.id)
            .train_name("Train 6".into())
            .start_time(max_time + Duration::minutes(10))
            .schedule(vec![])
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();

        // Test
        let train_schedules = timetable
            .schedules_in_time_window(&mut db_pool.get_ok(), min_time, max_time)
            .await
            .expect("Failed to get train schedules in time window");

        // Expected: Train 1, Train 3, Train 4, Train 5
        assert_eq!(train_schedules.len(), 4);
        let train_names: HashSet<_> = train_schedules
            .into_iter()
            .map(|ts| ts.train_name)
            .collect();
        assert!(train_names.contains("Train 1"));
        assert!(train_names.contains("Train 3"));
        assert!(train_names.contains("Train 4"));
        assert!(train_names.contains("Train 5"));
    }
}
