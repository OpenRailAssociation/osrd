use crate::error::Result;
use crate::views::infra::InfraApiError;
use crate::RedisClient;
use actix_web::post;
use actix_web::web::{Data, Json, Path};
use chashmap::CHashMap;
use diesel_async::AsyncPgConnection as PgConnection;
use thiserror::Error;

use crate::infra_cache::{InfraCache, ObjectCache};
use crate::map::{self, MapLayers};
use crate::models::{Infra, Update};
use crate::schema::operation::{CacheOperation, Operation, RailjsonObject};
use crate::{generated_data, refresh_search_tables_per_infra, DbPool};
use editoast_derive::EditoastError;

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

    let mut conn = db_pool.clone().get().await?;
    let infra = Infra::retrieve_for_update(&mut conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    let mut infra_cache = InfraCache::get_or_load_mut(&mut conn, &infra_caches, &infra).await?;
    let operation_results = apply_edit(&mut conn, &infra, &operations, &mut infra_cache).await?;

    let mut conn = redis_client.get_connection().await?;
    map::invalidate_all(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra_id,
    )
    .await?;

    let _ = refresh_search_tables_per_infra(db_pool, infra_id).await;

    Ok(Json(operation_results))
}

async fn apply_edit(
    conn: &mut PgConnection,
    infra: &Infra,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> Result<Vec<RailjsonObject>> {
    let infra_id = infra.id.unwrap();
    // Check if the infra is locked
    if infra.locked.unwrap() {
        return Err(EditionError::InfraIsLocked {
            infra_id: infra.id.unwrap(),
        }
        .into());
    }

    // Apply modifications
    let mut railjsons = vec![];
    let mut cache_operations = vec![];
    for operation in operations {
        let railjson = operation.apply(infra.id.unwrap(), conn).await?;
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
    let infra = infra
        .bump_version(conn)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;

    // Apply operations to infra cache
    infra_cache.apply_operations(&cache_operations)?;
    // Refresh layers if needed
    generated_data::update_all(conn, infra_id, &cache_operations, infra_cache)
        .await
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    let mut infra_bump = infra.clone();
    infra_bump.generated_version = Some(Some(infra.version.unwrap()));
    infra_bump
        .update_conn(conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;

    Ok(railjsons)
}

#[derive(Debug, Clone, Error, EditoastError)]
#[editoast_error(base_id = "infra:edition")]
enum EditionError {
    #[error("Infra {infra_id} is locked")]
    InfraIsLocked { infra_id: i64 },
}
