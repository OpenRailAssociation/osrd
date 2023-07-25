use super::SimulationOutput;
use crate::error::Result;
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::deserialize::QueryableByName;
use diesel::sql_types::{BigInt, Double, Nullable};
use diesel::{sql_query, RunQueryDsl};
use serde::{Deserialize, Serialize};

#[derive(Debug, QueryableByName, Serialize, Deserialize)]
pub struct OutputSimulationTrainSchedule {
    #[serde(flatten)]
    #[diesel(embed)]
    pub simulation_output: SimulationOutput,
    #[diesel(sql_type = Nullable<Double>)]
    pub schedule_departure_time: Option<f64>,
}

impl OutputSimulationTrainSchedule {
    pub async fn from_timetable_id(
        given_timetable_id: i64,
        db_pool: Data<DbPool>,
    ) -> Result<Vec<OutputSimulationTrainSchedule>> {
        block(move || {
            let mut conn = db_pool.get()?;
            let result = sql_query(include_str!("sql/output_simulation_from_timetable.sql"))
                .bind::<BigInt, _>(given_timetable_id)
                .load(&mut conn)?;
            Ok(result)
        })
        .await
        .unwrap()
    }
}
