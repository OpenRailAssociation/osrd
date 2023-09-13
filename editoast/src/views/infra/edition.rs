use crate::error::Result;
use crate::map::redis_utils::RedisClient;
use crate::views::infra::InfraApiError;
use actix_web::post;
use actix_web::web::{Data, Json, Path};
use chashmap::CHashMap;
use diesel_async::AsyncPgConnection as PgConnection;
use thiserror::Error;

use crate::client::MapLayersConfig;
use crate::infra_cache::InfraCache;
use crate::map::{self, MapLayers, Zone};
use crate::models::{Infra, Update};
use crate::schema::operation::{Operation, OperationResult};
use crate::{generated_data, routes, DbPool};
use editoast_derive::EditoastError;

routes! {
    edit
}

/// CRUD to edit an infrastructure. Takes a batch of operations.
#[utoipa::path(
    params(super::InfraId),
    responses(
        (status = 200, description = "Return the list of operations results", body = inline(Vec<OperationResult>)),
    ),
)]
#[post("")]
pub async fn edit(
    infra: Path<i64>,
    operations: Json<Vec<Operation>>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    redis_client: Data<RedisClient>,
    map_layers: Data<MapLayers>,
    map_layers_config: Data<MapLayersConfig>,
) -> Result<Json<Vec<OperationResult>>> {
    let infra_id = infra.into_inner();

    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_for_update(&mut conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    let mut infra_cache = InfraCache::get_or_load_mut(&mut conn, &infra_caches, &infra).await?;
    let (operation_results, invalid_zone) =
        apply_edit(&mut conn, &infra, &operations, &mut infra_cache).await?;

    let mut conn = redis_client.get_connection().await?;
    map::invalidate_zone(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra_id,
        &invalid_zone,
        &map_layers_config,
    )
    .await?;

    Ok(Json(operation_results))
}

async fn apply_edit(
    conn: &mut PgConnection,
    infra: &Infra,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> Result<(Vec<OperationResult>, Zone)> {
    let infra_id = infra.id.unwrap();
    // Check if the infra is locked
    if infra.locked.unwrap() {
        return Err(EditionError::InfraIsLocked(infra.id.unwrap()).into());
    }

    // Apply modifications
    let mut operation_results = vec![];
    for operation in operations.iter() {
        operation_results.push(operation.apply(infra.id.unwrap(), conn).await?);
    }

    // Bump version
    let infra = infra
        .bump_version(conn)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;

    // Compute cache invalidation zone
    let invalid_zone = Zone::compute(infra_cache, &operation_results);

    // Apply operations to infra cache
    infra_cache.apply_operations(&operation_results);
    // Refresh layers if needed
    generated_data::update_all(conn, infra_id, &operation_results, infra_cache)
        .await
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    let mut infra_bump = infra.clone();
    infra_bump.generated_version = Some(Some(infra.version.unwrap()));
    infra_bump
        .update_conn(conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;

    Ok((operation_results, invalid_zone))
}

#[derive(Debug, Clone, Error, EditoastError)]
#[editoast_error(base_id = "infra:edition")]
enum EditionError {
    #[error("Infra {0} is locked")]
    InfraIsLocked(i64),
}
