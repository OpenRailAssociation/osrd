pub mod path_item_cache;
pub mod pathfinding;
pub mod projection;
mod properties;

pub use pathfinding::pathfinding_from_train_batch;

use editoast_derive::EditoastError;
use thiserror::Error;

use crate::core::pathfinding::TrackRange;

crate::routes! {
    &properties,
    &pathfinding,
}

editoast_common::schemas! {
    pathfinding::schemas(),
    projection::schemas(),
    properties::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
pub enum PathfindingError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}
