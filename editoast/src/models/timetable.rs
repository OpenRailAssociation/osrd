use crate::diesel::QueryDsl;
use crate::error::Result;
use crate::models::train_schedule::TrainScheduleDetails;
use crate::tables::osrd_infra_timetable;
use crate::DbPool;
use actix_web::web::{block, Data};
use derivative::Derivative;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Debug,
    PartialEq,
    Queryable,
    Identifiable,
    Serialize,
    Selectable,
    Model,
    Derivative,
    Insertable,
    Deserialize,
)]
#[derivative(Default)]
#[model(table = "osrd_infra_timetable")]
#[model(create, delete, retrieve)]
#[diesel(table_name = osrd_infra_timetable)]
pub struct Timetable {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct TimetableWithSchedules {
    #[serde(flatten)]
    pub timetable: Timetable,
    pub train_schedules: Vec<TrainScheduleDetails>,
}

impl Timetable {
    /// Retrieves timetable with a specific id and its associated train schedules
    pub async fn with_train_schedules(
        self,
        db_pool: Data<DbPool>,
    ) -> Result<TimetableWithSchedules> {
        use crate::tables::osrd_infra_trainschedule::dsl;
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.get()?;
            let train_schedules: Vec<TrainScheduleDetails> = dsl::osrd_infra_trainschedule
                .filter(dsl::timetable_id.eq(self.id.unwrap()))
                .select((dsl::id, dsl::train_name, dsl::departure_time, dsl::path_id))
                .load(&mut conn)?;

            Ok(TimetableWithSchedules {
                timetable: self,
                train_schedules,
            })
        })
        .await
        .unwrap()
    }
}
