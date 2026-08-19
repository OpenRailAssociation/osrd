use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(
    Clone,
    Copy,
    Debug,
    Default,
    Deserialize,
    DeriveActiveEnum,
    EnumIter,
    Eq,
    PartialEq,
    Serialize,
    ToSchema,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "Enum", db_type = "Enum", enum_name = "timetable_type")]
pub enum TimetableType {
    #[default]
    #[sea_orm(string_value = "CALENDAR")]
    Calendar,
    #[sea_orm(string_value = "HOURLY")]
    Hourly,
}

impl From<schemas::timetable_type::TimetableType> for TimetableType {
    fn from(value: schemas::timetable_type::TimetableType) -> Self {
        match value {
            schemas::timetable_type::TimetableType::Calendar => Self::Calendar,
            schemas::timetable_type::TimetableType::Hourly => Self::Hourly,
        }
    }
}

impl From<TimetableType> for schemas::timetable_type::TimetableType {
    fn from(value: TimetableType) -> Self {
        match value {
            TimetableType::Calendar => Self::Calendar,
            TimetableType::Hourly => Self::Hourly,
        }
    }
}
