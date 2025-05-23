use chrono::DateTime;
use chrono::Utc;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    Waypoint,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypointResponse)]
pub struct Waypoint {
    pub ci: u32,
    pub ch: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SimilarScheduleItem {
    pub schedule_id: String,
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
