use std::sync::Arc;

use chashmap::CHashMap;
use diesel::PgConnection;
use rocket::serde::json::{Error as JsonError, Json};
use rocket::State;

use crate::api_error::{ApiResult, InfraLockedError};
use crate::chartos::{self, InvalidationZone, MapLayers};
use crate::client::MapLayersConfig;
use crate::db_connection::{DBConnection, RedisPool};
use crate::generated_data;
use crate::infra::Infra;
use crate::infra_cache::InfraCache;
use crate::schema::operation::{Operation, OperationResult};

/// Return the endpoints routes of this module
pub fn routes() -> Vec<rocket::Route> {
    routes![edit]
}

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("/<infra>", data = "<operations>")]
async fn edit<'a>(
    infra: i64,
    operations: Result<Json<Vec<Operation>>, JsonError<'a>>,
    infra_caches: &State<Arc<CHashMap<i64, InfraCache>>>,
    redis_pool: &RedisPool,
    map_layers: &State<MapLayers>,
    conn: DBConnection,
    map_layers_config: &State<MapLayersConfig>,
) -> ApiResult<Json<Vec<OperationResult>>> {
    let operations = operations?;
    let infra_caches = infra_caches.inner().clone();

    let (operation_results, invalid_zone) = conn
        .run::<_, ApiResult<_>>(move |conn| {
            let infra = Infra::retrieve_for_update(conn, infra)?;
            let mut infra_cache = InfraCache::get_or_load_mut(conn, &infra_caches, &infra).unwrap();
            apply_edit(conn, &infra, &operations, &mut infra_cache)
        })
        .await?;

    chartos::invalidate_zone(
        redis_pool,
        &map_layers.layers.keys().cloned().collect(),
        infra,
        &invalid_zone,
        map_layers_config.max_tiles,
    )
    .await;

    Ok(Json(operation_results))
}

fn apply_edit(
    conn: &mut PgConnection,
    infra: &Infra,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> ApiResult<(Vec<OperationResult>, InvalidationZone)> {
    // Check if the infra is locked
    if infra.locked {
        return Err(InfraLockedError { infra_id: infra.id }.into());
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
