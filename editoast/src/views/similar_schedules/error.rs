use editoast_derive::EditoastError;

#[derive(Debug, thiserror::Error, EditoastError)]
#[cfg_attr(test, derive(PartialEq))]
#[editoast_error(base_id = "similar_schedules")]
pub enum Error {
    #[error("Not enough waypoints to split into segments")]
    NotEnoughWaypoints,
    #[error("First waypoint is not a stop")]
    FirstWaypointNotAStop,
    #[error("Last waypoint is not a stop")]
    LastWaypointNotAStop,
    #[error("Rolling stock '{rolling_stock_name}', could not be found")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_name: String },
    #[error("Speed limit tag not found")]
    SpeedLimitTagNotFound,
    #[error("Empty segment")]
    EmptySegment,
    #[error("Graph construction failed")]
    GraphConstructionFailed,
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}
