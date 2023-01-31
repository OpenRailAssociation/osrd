use crate::error::Result;
use actix_web::http::StatusCode;
use actix_web::post;
use actix_web::web::{block, Data, Json, Path};
use chashmap::CHashMap;
use diesel::PgConnection;
use redis::Client;
use thiserror::Error;

use crate::client::MapLayersConfig;
use crate::error::EditoastError;
use crate::infra::Infra;
use crate::infra_cache::InfraCache;
use crate::map::{self, InvalidationZone, MapLayers};
use crate::schema::operation::{Operation, OperationResult};
use crate::{generated_data, DbPool};

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("")]
pub async fn edit<'a>(
    infra: Path<i64>,
    operations: Json<Vec<Operation>>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    redis_client: Data<Client>,
    map_layers: Data<MapLayers>,
    map_layers_config: Data<MapLayersConfig>,
) -> Result<Json<Vec<OperationResult>>> {
    let infra = infra.into_inner();
    let (operation_results, invalid_zone) = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        let infra = Infra::retrieve_for_update(&mut conn, infra)?;
        let mut infra_cache =
            InfraCache::get_or_load_mut(&mut conn, &infra_caches, &infra).unwrap();
        apply_edit(&mut conn, &infra, &operations, &mut infra_cache)
    })
    .await
    .unwrap()?;

    let mut conn = redis_client.get_tokio_connection_manager().await.unwrap();
    map::invalidate_zone(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra,
        &invalid_zone,
        map_layers_config.max_tiles,
    )
    .await?;

    Ok(Json(operation_results))
}

fn apply_edit(
    conn: &mut PgConnection,
    infra: &Infra,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> Result<(Vec<OperationResult>, InvalidationZone)> {
    // Check if the infra is locked
    if infra.locked {
        return Err(InfraLockedError(infra.id).into());
    }

    // Apply modifications
    let mut operation_results = vec![];
    for operation in operations.iter() {
        operation_results.push(operation.apply(infra.id, conn)?);
    }

    // Bump version
    let infra = infra.bump_version(conn)?;

    // Compute cache invalidation zone
    let invalid_zone = InvalidationZone::compute(infra_cache, &operation_results);

    // Apply operations to infra cache
    infra_cache.apply_operations(&operation_results);
    // Refresh layers if needed
    generated_data::update_all(conn, infra.id, &operation_results, infra_cache)
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    infra.bump_generated_version(conn)?;

    // update infra modified medata
    infra.update_modified_timestamp_to_now(conn)?;

    Ok((operation_results, invalid_zone))
}

#[derive(Debug, Clone, Error)]
struct InfraLockedError(pub i64);

impl std::fmt::Display for InfraLockedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Infra {} is locked", self.0)
    }
}

impl EditoastError for InfraLockedError {
    fn get_status(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }

    fn get_type(&self) -> &'static str {
        "editoast:infra:edition:locked"
    }
}
