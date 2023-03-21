use crate::models::train_schedule::TrainScheduleDetails;
use crate::tables::osrd_infra_scenario;
use crate::{error::Result, DbPool};
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::sql_types::{Array, BigInt, Nullable, Text};
use diesel::QueryDsl;
use diesel::{ExpressionMethods, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Clone,
    Debug,
    Serialize,
    Deserialize,
    Derivative,
    Queryable,
    QueryableByName,
    Insertable,
    Identifiable,
    Model,
)]
#[derivative(Default)]
#[model(table = "osrd_infra_scenario")]
#[model(create)]
#[diesel(table_name = osrd_infra_scenario)]
pub struct Scenario {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    #[diesel(column_name = "study_id")]
    pub study: Option<i64>,
    #[diesel(deserialize_as = i64)]
    #[diesel(column_name = "infra_id")]
    pub infra: Option<i64>,
    #[diesel(deserialize_as = Option<i64>)]
    #[diesel(column_name = "electrical_profile_set_id")]
    pub electrical_profile_set: Option<Option<i64>>,
    #[diesel(deserialize_as = i64)]
    #[diesel(column_name = "timetable_id")]
    pub timetable: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    pub description: Option<String>,
    #[diesel(deserialize_as = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = Vec<String>)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct ScenarioWithDetails {
    #[serde(flatten)]
    #[diesel(embed)]
    pub scenario: Scenario,
    #[diesel(sql_type = Text)]
    pub infra_name: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub electrical_profile_set_name: Option<String>,
    #[diesel(sql_type = Array<TrainScheduleDetails>)]
    pub train_schedules: Vec<TrainScheduleDetails>,
    #[diesel(sql_type = BigInt)]
    pub train_count: i64,
}

impl Scenario {
    pub async fn with_details(self, db_pool: Data<DbPool>) -> Result<ScenarioWithDetails> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_electricalprofileset::dsl as elec_dsl;
            use crate::tables::osrd_infra_infra::dsl as infra_dsl;
            use crate::tables::osrd_infra_trainschedule::dsl::*;
            let mut conn = db_pool.get()?;
            let infra_name = infra_dsl::osrd_infra_infra
                .filter(infra_dsl::id.eq(self.infra.unwrap()))
                .select(infra_dsl::name)
                .first::<String>(&mut conn)?;

            let electrical_profile_set_name = match self.electrical_profile_set.unwrap() {
                Some(electrical_profile_set) => Some(
                    elec_dsl::osrd_infra_electricalprofileset
                        .filter(elec_dsl::id.eq(electrical_profile_set))
                        .select(elec_dsl::name)
                        .first::<String>(&mut conn)?,
                ),
                None => None,
            };

            let train_schedules = osrd_infra_trainschedule
                .filter(timetable_id.eq(self.timetable.unwrap()))
                .select((id, train_name, departure_time, path_id))
                .load::<TrainScheduleDetails>(&mut conn)?;

            let train_count = train_schedules.len() as i64;

            Ok(ScenarioWithDetails {
                scenario: self,
                infra_name,
                electrical_profile_set_name,
                train_schedules,
                train_count,
            })
        })
        .await
        .unwrap()
    }
}
