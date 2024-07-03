use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Nullable;
use editoast_derive::ModelV2;

use crate::error::Result;
use crate::modelsv2::Retrieve;
use editoast_models::DbConnection;

#[derive(Debug, Default, Clone, ModelV2, PartialEq)]
#[model(table = crate::tables::timetable_v2)]
#[cfg_attr(test, derive(serde::Deserialize))]
pub struct Timetable {
    pub id: i64,
    pub electrical_profile_set_id: Option<i64>,
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
    async fn retrieve(conn: &mut DbConnection, timetable_id: i64) -> Result<Option<Self>> {
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

impl From<TimetableWithTrains> for Timetable {
    fn from(timetable_with_trains: TimetableWithTrains) -> Self {
        Self {
            id: timetable_with_trains.id,
            electrical_profile_set_id: timetable_with_trains.electrical_profile_set_id,
        }
    }
}
