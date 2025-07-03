use chrono::DateTime;
use chrono::Utc;
use serde::Serialize;
use smol_str::SmolStr;
use utoipa::ToSchema;

use super::past_schedule;

editoast_common::schemas! {
    Waypoint,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypointResponse)]
pub struct Waypoint {
    pub ci: i64,
    #[schema(value_type = String)]
    pub ch: SmolStr,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SimilarScheduleItem {
    #[schema(value_type = String)]
    pub schedule_id: past_schedule::Name,
    pub start_time: DateTime<Utc>,
    #[schema(value_type = SimilarScheduleWaypointResponse)]
    pub begin: Waypoint,
    #[schema(value_type = SimilarScheduleWaypointResponse)]
    pub end: Waypoint,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Response {
    #[schema(inline)]
    pub similar_schedules: Vec<SimilarScheduleItem>,
}
