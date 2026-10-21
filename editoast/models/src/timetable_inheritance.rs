use editoast_derive::Model;
use schemas::primitives::StrictlyPositiveDuration;
use serde::Deserialize;
use serde::Serialize;
use unit_system::quantities::Offset;
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct TimetableRange {
    #[serde(with = "unit_system::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub start_time: Offset,
    pub time_window: StrictlyPositiveDuration,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TimetableRanges(pub Option<Vec<TimetableRange>>);

impl From<TimetableRanges> for Option<diesel_json::Json<Vec<TimetableRange>>> {
    fn from(ranges: TimetableRanges) -> Self {
        ranges.0.map(diesel_json::Json)
    }
}

impl From<Option<diesel_json::Json<Vec<TimetableRange>>>> for TimetableRanges {
    fn from(ranges: Option<diesel_json::Json<Vec<TimetableRange>>>) -> Self {
        Self(ranges.map(|ranges| ranges.0))
    }
}

/// Inclusion of the timetable of a train schedule set (inner) in another timetable (outer)
#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default, PartialEq))]
#[model(table = database::tables::timetable_inheritance)]
#[model(gen(ops = crud, batch_ops = crud, list))]
pub struct TimetableInheritance {
    pub id: i64,
    pub outer_timetable_id: i64,
    pub inner_timetable_id: i64,
    #[model(remote = "Option<diesel_json::Json<Vec<TimetableRange>>>")]
    pub ranges: TimetableRanges,
}
