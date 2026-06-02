use super::PositiveDuration;
use common::units::quantities::Offset;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TimeWindow {
    #[serde(with = "common::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub time_begin: Offset,
    #[schema(value_type = chrono::Duration, example = "PT5M")]
    pub duration: PositiveDuration,
}
