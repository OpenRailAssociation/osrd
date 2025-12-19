use super::PositiveDuration;
use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TimeWindow {
    pub time_begin: DateTime<Utc>,
    #[schema(value_type = chrono::Duration, example = "PT5M")]
    pub duration: PositiveDuration,
}
