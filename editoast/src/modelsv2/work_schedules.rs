use crate::schema::TrackRange;
use chrono::NaiveDateTime;
use editoast_derive::ModelV2;
use strum::FromRepr;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, ModelV2)]
#[model(table = crate::tables::work_schedule_group)]
pub struct WorkScheduleGroup {
    pub id: i64,
    pub creation_date: NaiveDateTime,
    pub name: String,
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum WorkScheduleType {
    #[default]
    Catenary,
    Track,
}

#[derive(Debug, Default, Clone, ModelV2)]
#[model(table = crate::tables::work_schedule)]
pub struct WorkSchedule {
    pub id: i64,
    pub start_date_time: NaiveDateTime,
    pub end_date_time: NaiveDateTime,
    #[model(json)]
    pub track_ranges: Vec<TrackRange>,
    pub obj_id: String,
    #[model(to_enum)]
    pub work_schedule_type: WorkScheduleType,
    pub work_schedule_group_id: i64,
}
