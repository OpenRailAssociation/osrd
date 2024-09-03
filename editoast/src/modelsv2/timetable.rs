use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel_async::RunQueryDsl;
use std::ops::DerefMut;

use crate::error::Result;
use crate::models::Identifiable;
use crate::modelsv2::{DeleteStatic, Retrieve};
use crate::Exists;
use editoast_models::tables::timetable_v2::dsl;
use editoast_models::DbConnection;

#[derive(Debug, Default, Clone, PartialEq, Queryable, Identifiable)]
#[diesel(table_name = editoast_models::tables::timetable_v2)]
#[cfg_attr(test, derive(serde::Deserialize))]
pub struct Timetable {
    pub id: i64,
}

impl Timetable {
    #[tracing::instrument(name = "model:create<Timetable>", skip_all, err)]
    pub async fn create(conn: &DbConnection) -> Result<Self> {
        diesel::insert_into(editoast_models::tables::timetable_v2::table)
            .default_values()
            .get_result::<Timetable>(conn.write().await.deref_mut())
            .await
            .map(Into::into)
            .map_err(Into::into)
    }
}

#[async_trait::async_trait]
impl DeleteStatic<i64> for Timetable {
    #[allow(clippy::blocks_in_conditions)] // TODO: Remove this once using clippy 0.1.80
    #[tracing::instrument(name = "model:delete_static<Timetable>", skip_all, ret, err)]
    async fn delete_static(conn: &DbConnection, id: i64) -> Result<bool> {
        diesel::delete(dsl::timetable_v2.filter(dsl::id.eq(id)))
            .execute(conn.write().await.deref_mut())
            .await
            .map(|n| n == 1)
            .map_err(Into::into)
    }
}

#[async_trait::async_trait]
impl Retrieve<i64> for Timetable {
    #[allow(clippy::blocks_in_conditions)] // TODO: Remove this once using clippy 0.1.80
    #[tracing::instrument(name = "model:retrieve<Timetable>", skip_all, err)]
    async fn retrieve(
        conn: &editoast_models::DbConnection,
        id: i64,
    ) -> crate::error::Result<Option<Timetable>> {
        dsl::timetable_v2
            .filter(dsl::id.eq(id))
            .first::<Timetable>(conn.write().await.deref_mut())
            .await
            .optional()
            .map_err(Into::into)
    }
}

#[async_trait::async_trait]
impl Exists<i64> for Timetable {
    #[allow(clippy::blocks_in_conditions)] // TODO: Remove this once using clippy 0.1.80
    #[tracing::instrument(name = "model:exists<Timetable>", skip_all, ret, err)]
    async fn exists(conn: &DbConnection, id: i64) -> Result<bool> {
        Self::retrieve(conn, id)
            .await
            .map(|r| r.is_some())
            .map_err(Into::into)
    }
}

impl Identifiable<i64> for Timetable {
    fn get_id(&self) -> i64 {
        self.id
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
    async fn retrieve(conn: &DbConnection, timetable_id: i64) -> Result<Option<Self>> {
        let result = sql_query(
            "SELECT timetable_v2.*,
        array_remove(array_agg(train_schedule_v2.id), NULL) as train_ids
        FROM timetable_v2
        LEFT JOIN train_schedule_v2 ON timetable_v2.id = train_schedule_v2.timetable_id
        WHERE timetable_v2.id = $1
        GROUP BY timetable_v2.id",
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
