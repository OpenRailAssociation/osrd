pub mod path_item_cache;
pub mod pathfinding;
pub mod projection;
mod properties;

pub use pathfinding::pathfinding_from_train_batch;

use editoast_derive::EditoastError;
use thiserror::Error;

use crate::core::pathfinding::TrackRange;
use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use editoast_models::DbConnection;

crate::routes! {
    &properties,
    &pathfinding,
}

editoast_common::schemas! {
    pathfinding::schemas(),
    properties::schemas(),
    TrackRange,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
pub enum PathfindingError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

async fn retrieve_infra_version(conn: &mut DbConnection, infra_id: i64) -> Result<String> {
    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;
    Ok(infra.version)
}
