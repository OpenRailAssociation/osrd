use crate::models::Timetable;
use crate::tables::osrd_infra_trainschedule;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(
    Queryable,
    Selectable,
    Identifiable,
    Associations,
    Serialize,
    Deserialize,
    Debug,
    PartialEq,
    Clone,
)]
#[diesel(belongs_to(Timetable))]
#[diesel(table_name = osrd_infra_trainschedule)]
pub struct TrainSchedule {
    pub id: i64,
    pub train_name: String,
    pub labels: JsonValue,
    pub departure_time: f64,
    pub initial_speed: f64,
    pub allowances: JsonValue,
    pub comfort: String,
    pub speed_limit_tags: Option<String>,
    pub power_restriction_ranges: Option<JsonValue>,
    pub options: Option<JsonValue>,
    pub path_id: i64,
    pub rolling_stock_id: i64,
    pub timetable_id: i64,
}
#[derive(Serialize, Debug, PartialEq, Clone, Queryable)]
pub struct TrainScheduleDetails {
    pub id: i64,
    pub train_name: String,
    pub departure_time: f64,
    pub train_path: i64,
}
