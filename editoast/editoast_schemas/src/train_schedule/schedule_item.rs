use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::PositiveDuration;

editoast_common::schemas! {
    ScheduleItem,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ScheduleItem {
    #[schema(inline)]
    pub at: NonBlankString,
    #[schema(value_type = Option<chrono::Duration>)]
    pub arrival: Option<PositiveDuration>,
    #[schema(value_type = Option<chrono::Duration>)]
    pub stop_for: Option<PositiveDuration>,
    #[serde(default)]
    pub locked: bool,
}
