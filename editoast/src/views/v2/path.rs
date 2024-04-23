mod pathfinding;
mod properties;

pub use pathfinding::pathfinding_from_train;

use diesel_async::AsyncPgConnection as PgConnection;
use editoast_derive::EditoastError;
use thiserror::Error;

use crate::core::v2::pathfinding::TrackRange;
use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;

/// Expiration time for the cache of the pathfinding and path properties.
/// Note: 604800 seconds = 1 week
const CACHE_PATH_EXPIRATION: u64 = 604800;

crate::routes! {
    properties::routes(),
    pathfinding::routes(),
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

async fn retrieve_infra_version(conn: &mut PgConnection, infra_id: i64) -> Result<String> {
    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;
    Ok(infra.version)
}
