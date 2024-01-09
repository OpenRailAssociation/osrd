mod bounding_box;
mod layer_cache;
mod layers;
pub mod redis_utils;

use std::collections::HashMap;

use crate::client::MapLayersConfig;
use crate::error::Result;
pub use bounding_box::{BoundingBox, Zone};
pub use layers::{Layer, MapLayers, View};
use redis::aio::ConnectionLike;

pub use self::layer_cache::{
    count_tiles, get_cache_tile_key, get_layer_cache_prefix, get_tiles_to_invalidate,
    get_view_cache_prefix, Tile,
};
pub use self::redis_utils::{delete, get, keys, set};

crate::schemas! {
    bounding_box::schemas(),
}

/// Invalidates cache for specific
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `tiles_to_invalidate` - View cache prefix to tiles
async fn invalidate_cache_tiles<C: ConnectionLike>(
    redis: &mut C,
    tiles_to_invalidate: HashMap<String, Vec<Tile>>,
) -> Result<u64> {
    let mut keys_to_delete: Vec<String> = Vec::new();
    for (view_cache_prefix, tiles) in tiles_to_invalidate {
        for tile in tiles {
            keys_to_delete.push(get_cache_tile_key(&view_cache_prefix, &tile));
        }
    }
    let number_of_deleted_keys = delete(redis, keys_to_delete).await?;
    Ok(number_of_deleted_keys)
}

/// Invalidate a zone of an infra view
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `infra_id` - Infra to on which the layer must be invalidated
/// * `layer_name` - Layer on which invalidation must be done
/// * `view_name` - Layer on which invalidation must be done
/// * `bbox` - Bounding Box to invalidate (full view if None)
#[allow(dead_code)]
async fn invalidate_view_bbox<C: ConnectionLike>(
    redis: &mut C,
    infra_id: i64,
    layer_name: &str,
    view_name: &str,
    bbox: &BoundingBox,
    map_config: &MapLayersConfig,
) -> Result<()> {
    let max_zoom = map_config.max_zoom;
    let max_tiles = map_config.max_tiles;
    if count_tiles(max_zoom, bbox) > max_tiles {
        invalidate_full_view_cache(redis, infra_id, layer_name, view_name).await?;
        return Ok(());
    }

    let affected_tiles: HashMap<String, Vec<Tile>> = HashMap::from([(
        get_view_cache_prefix(layer_name, infra_id, view_name),
        get_tiles_to_invalidate(max_zoom, bbox),
    )]);
    invalidate_cache_tiles(redis, affected_tiles).await?;
    Ok(())
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

/// Invalidates layer cache for a specific infra and view if provided
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `infra_id` - Infra on which the layer must be invalidated
/// * `layer_name` - Layer to invalidate
/// * `view_name` - Specific view to invalidate
///
/// Returns the number of deleted keys
async fn invalidate_full_view_cache<C: ConnectionLike>(
    redis: &mut C,
    infra_id: i64,
    layer_name: &str,
    view_name: &str,
) -> Result<u64> {
    let prefix: String = get_view_cache_prefix(layer_name, infra_id, view_name);
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
