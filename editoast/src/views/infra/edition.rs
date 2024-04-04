use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use chashmap::CHashMap;
use diesel_async::AsyncPgConnection as PgConnection;
use editoast_derive::EditoastError;
use thiserror::Error;

use crate::error::Result;
use crate::generated_data;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::operation::Operation;
use crate::infra_cache::operation::RailjsonObject;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::map::MapLayers;
use crate::map::{self};
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::DbPool;
use crate::RedisClient;

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("")]
pub async fn edit<'a>(
    infra: Path<i64>,
    operations: Json<Vec<Operation>>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    redis_client: Data<RedisClient>,
    map_layers: Data<MapLayers>,
) -> Result<Json<Vec<RailjsonObject>>> {
    let infra_id = infra.into_inner();

    let mut conn = db_pool.get().await?;
    // TODO: lock for update
    let mut infra =
        Infra::retrieve_or_fail(&mut conn, infra_id, || InfraApiError::NotFound { infra_id })
            .await?;
    let mut infra_cache = InfraCache::get_or_load_mut(&mut conn, &infra_caches, &infra).await?;
    let operation_results =
        apply_edit(&mut conn, &mut infra, &operations, &mut infra_cache).await?;

    let mut conn = redis_client.get_connection().await?;
    map::invalidate_all(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra_id,
    )
    .await?;

    Ok(Json(operation_results))
}

async fn apply_edit(
    conn: &mut PgConnection,
    infra: &mut Infra,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> Result<Vec<RailjsonObject>> {
    let infra_id = infra.id;
    // Check if the infra is locked
    if infra.locked {
        return Err(EditionError::InfraIsLocked { infra_id }.into());
    }

    // Apply modifications
    let mut railjsons = vec![];
    let mut cache_operations = vec![];
    for operation in operations {
        let railjson = operation.apply(infra_id, conn).await?;
        match (operation, railjson) {
            (Operation::Create(_), Some(railjson)) => {
                railjsons.push(railjson.clone());
                cache_operations.push(CacheOperation::Create(ObjectCache::from(railjson)));
            }
            (Operation::Update(_), Some(railjson)) => {
                railjsons.push(railjson.clone());
                cache_operations.push(CacheOperation::Update(ObjectCache::from(railjson)));
            }
            (Operation::Delete(delete_operation), _) => {
                cache_operations.push(CacheOperation::Delete(delete_operation.clone().into()));
            }
            _ => unreachable!("CREATE and UPDATE always produce a RailJSON"),
        }
    }

    // Bump version
    infra.bump_version(conn).await?;

    // Apply operations to infra cache
    infra_cache.apply_operations(&cache_operations)?;

    // Refresh layers if needed
    generated_data::update_all(conn, infra_id, &cache_operations, infra_cache)
        .await
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    infra.bump_generated_version(conn).await?;

    Ok(railjsons)
}

#[derive(Debug, Clone, Error, EditoastError)]
#[editoast_error(base_id = "infra:edition")]
enum EditionError {
    #[error("Infra {infra_id} is locked")]
    InfraIsLocked { infra_id: i64 },
}
