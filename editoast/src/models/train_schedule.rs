use crate::models::Timetable;
use crate::tables::osrd_infra_trainschedule;
use diesel::prelude::*;
use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Debug, PartialEq)]
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
