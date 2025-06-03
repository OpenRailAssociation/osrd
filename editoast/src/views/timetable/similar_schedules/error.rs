use editoast_derive::EditoastError;

#[derive(Debug, thiserror::Error, EditoastError)]
#[cfg_attr(test, derive(PartialEq))]
#[editoast_error(base_id = "similar_schedules")]
pub enum Error {
    #[error("Not enough waypoints to split into segments")]
    #[editoast_error(status = 400)]
    NotEnoughWaypoints,
    #[error("First waypoint is not a stop")]
    #[editoast_error(status = 400)]
    FirstWaypointNotAStop,
    #[error("Last waypoint is not a stop")]
    #[editoast_error(status = 400)]
    LastWaypointNotAStop,
    #[error("Rolling stock '{rolling_stock_name}', could not be found")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_name: String },
    #[error("Speed limit tag not found")]
    #[editoast_error(status = 404)]
    SpeedLimitTagNotFound,
    #[error("Empty segment")]
    #[editoast_error(status = 400)]
    EmptySegment,
    #[error("Graph construction failed")]
    #[editoast_error(status = 500)]
    GraphConstructionFailed,
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
}
