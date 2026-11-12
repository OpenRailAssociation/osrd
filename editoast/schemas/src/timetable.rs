use serde::Deserialize;
use serde::Serialize;
use unit_system::quantities::Offset;
use utoipa::ToSchema;

use crate::primitives::StrictlyPositiveDuration;
use crate::timetable_type::TimetableType;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct Timetable {
    pub id: i64,
    pub timetable_type: TimetableType,
    pub train_schedule_set_id: Option<i64>,
    pub is_train_schedule_set: bool,
    pub catalog_entry_id: Option<i64>,
    pub name: Option<String>,
    pub description: String,
    pub published: bool,
}

/// A timetable included in another timetable
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct InnerTimetable {
    pub timetable: Timetable,
    pub ranges: Option<Vec<TimetableRange>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct TimetableRange {
    #[serde(with = "unit_system::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub start_time: Offset,
    pub time_window: StrictlyPositiveDuration,
}
