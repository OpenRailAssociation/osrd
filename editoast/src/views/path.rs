pub mod operational_point_cache;
pub mod pathfinding;
pub mod projection;
pub(super) mod properties;

pub use pathfinding::pathfinding_from_train_batch;

use editoast_derive::EditoastError;
use thiserror::Error;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
pub enum PathfindingError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] models::Error),
}
