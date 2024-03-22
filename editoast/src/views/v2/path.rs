mod pathfinding;
mod properties;

use diesel_async::AsyncPgConnection as PgConnection;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::Infra;
use crate::modelsv2::prelude::*;
use crate::schema::utils::Identifier;
use crate::schema::Direction;
use editoast_derive::EditoastError;
use thiserror::Error;

/// Expiration time for the cache of the pathfinding and path properties.
/// Note: 604800 seconds = 1 week
const CACHE_PATH_EXPIRATION: u64 = 604800;

crate::routes! {
    properties::routes(),
    pathfinding::routes(),
}

crate::schemas! {
    pathfinding::schemas(),
    properties::schemas(),
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash)]
struct TrackRange {
    #[schema(inline)]
    track_section: Identifier,
    begin: u64,
    end: u64,
    direction: Direction,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
enum PathfindingError {
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
