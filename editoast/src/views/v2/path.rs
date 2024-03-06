mod pathfinding;
mod properties;

use chrono::Duration;
use diesel_async::AsyncPgConnection as PgConnection;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::Infra;
use crate::models::Retrieve;
use crate::schema::utils::Identifier;
use crate::schema::Direction;
use editoast_derive::EditoastError;
use thiserror::Error;

/// Expiration time for the cache of the pathfinding and path properties is set to 1 week
const CACHE_PATH_EXPIRATION: u64 = Duration::weeks(1).num_seconds() as u64;

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
    let infra = Infra::retrieve_conn(conn, infra_id)
        .await?
        .ok_or(PathfindingError::InfraNotFound { infra_id })?;
    Ok(infra.version.unwrap())
}
