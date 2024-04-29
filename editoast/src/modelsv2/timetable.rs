use async_trait::async_trait;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Nullable;
use editoast_derive::ModelV2;

use crate::diesel::query_dsl::methods::DistinctDsl;
use crate::error::Result;
use crate::models::List;
use crate::models::NoParams;
use crate::modelsv2::Connection;
use crate::modelsv2::Retrieve;
use crate::modelsv2::Row;
use crate::tables::timetable_v2::dsl;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;

#[derive(Debug, Default, Clone, ModelV2)]
#[model(table = crate::tables::timetable_v2)]
pub struct Timetable {
    pub id: i64,
    pub electrical_profile_set_id: Option<i64>,
}

#[async_trait]
impl List<NoParams> for Timetable {
    async fn list_conn(
        conn: &mut Connection,
        page: i64,
        page_size: i64,
        _: NoParams,
    ) -> Result<PaginatedResponse<Self>> {
        let timetable_rows = dsl::timetable_v2
            .distinct()
            .paginate(page, page_size)
            .load_and_count::<Row<Timetable>>(conn)
            .await?;

        Ok(timetable_rows.into())
    }
}

/// Should be used to retrieve a timetable with its trains
#[derive(Debug, Clone, QueryableByName)]
pub struct TimetableWithTrains {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub electrical_profile_set_id: Option<i64>,
    #[diesel(sql_type = Array<BigInt>)]
    pub train_ids: Vec<i64>,
}

#[async_trait::async_trait]
impl Retrieve<i64> for TimetableWithTrains {
    async fn retrieve(conn: &mut Connection, timetable_id: i64) -> Result<Option<Self>> {
        use diesel_async::RunQueryDsl;
        let result = sql_query(
            "SELECT timetable_v2.*,
        array_remove(array_agg(train_schedule_v2.id), NULL) as train_ids
        FROM timetable_v2
        LEFT JOIN train_schedule_v2 ON timetable_v2.id = train_schedule_v2.timetable_id
        WHERE timetable_v2.id = $1
        GROUP BY timetable_v2.id",
        )
        .bind::<BigInt, _>(timetable_id)
        .get_result::<TimetableWithTrains>(conn)
        .await;
        match result {
            Ok(result) => Ok(Some(result)),
            Err(diesel::result::Error::NotFound) => Ok(None),
            Err(err) => Err(err.into()),
        }
    }
}
