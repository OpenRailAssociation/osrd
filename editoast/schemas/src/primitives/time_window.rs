use super::PositiveDuration;
use serde::Deserialize;
use serde::Serialize;
use unit_system::quantities::Offset;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TimeWindow {
    #[serde(with = "unit_system::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub time_begin: Offset,
    #[schema(value_type = chrono::Duration, example = "PT5M")]
    pub duration: PositiveDuration,
}
