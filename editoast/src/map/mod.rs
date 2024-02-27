mod bounding_box;
mod layer_cache;
mod layers;
pub mod redis_utils;

use crate::error::Result;
pub use bounding_box::{BoundingBox, Zone};
pub use layers::{Layer, MapLayers, View};
use redis::aio::ConnectionLike;

pub use self::layer_cache::{
    get_cache_tile_key, get_layer_cache_prefix, get_view_cache_prefix, Tile,
};
pub use self::redis_utils::{delete, get, keys, set};

crate::schemas! {
    bounding_box::schemas(),
}

/// Invalidates layer cache for a specific infra and view if provided
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `infra_id` - Infra on which the layer must be invalidated
/// * `layer_name` - Layer to invalidate
///
/// Returns the number of deleted keys
async fn invalidate_full_layer_cache<C: ConnectionLike>(
    redis: &mut C,
    infra_id: i64,
    layer_name: &str,
) -> Result<u64> {
    let prefix: String = get_layer_cache_prefix(layer_name, infra_id);
    let matching_keys = keys(redis, &format!("{prefix}.*")).await?;
    let number_of_deleted_keys = delete(redis, matching_keys).await?;
    Ok(number_of_deleted_keys)
}

/// Invalidates all map layers of a specific infra
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `layers` - Layers to invalidate
/// * `infra_id` - Infra to on which layers must be invalidated
///
/// Panics if fail
pub async fn invalidate_all<C: ConnectionLike>(
    redis: &mut C,
    layers: &Vec<String>,
    infra_id: i64,
) -> Result<()> {
    for layer_name in layers {
        invalidate_full_layer_cache(redis, infra_id, layer_name).await?;
    }
    Ok(())
}
