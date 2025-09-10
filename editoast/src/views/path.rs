pub mod path_item_cache;
pub mod pathfinding;
pub mod projection;
pub(super) mod properties;

pub use pathfinding::pathfinding_from_train_batch;

use database::DbConnection;
use editoast_derive::EditoastError;
use thiserror::Error;

use crate::error::Result;
use crate::models::Infra;
use editoast_models::prelude::*;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
pub enum PathfindingError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

async fn retrieve_infra_version(conn: &mut DbConnection, infra_id: i64) -> Result<i64> {
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        PathfindingError::InfraNotFound { infra_id }
    })
    .await?;
    Ok(infra.version)
}
