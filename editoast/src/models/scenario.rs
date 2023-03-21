use super::TrainSchedule;
use crate::tables::osrd_infra_scenario;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::sql_types::Array;
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
pub struct ScenarioWithTrains {
    #[serde(flatten)]
    #[diesel(embed)]
    pub scenario: Scenario,
    #[diesel(sql_type = Array<TrainSchedule>)]
    pub train_schedules: Vec<TrainSchedule>,
}
