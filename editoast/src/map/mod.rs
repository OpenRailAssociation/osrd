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
pub use bounding_box::schemas;

/// Invalidates layer cache for a specific infra and view if provided
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `infra_id` - Infra to on which the layer must be invalidated
/// * `layer_name` - Layer to invalidate
/// * `view_name` - Specific view to invalidate, if not provided all layer's views are invalidated
///
/// Returns the number of deleted keys
async fn invalidate_full_layer_cache<C: ConnectionLike>(
    redis: &mut C,
    infra_id: i64,
    layer_name: &str,
    view_name: Option<&str>,
) -> Result<u64> {
    let prefix: String = view_name.map_or(get_layer_cache_prefix(layer_name, infra_id), |view| {
        get_view_cache_prefix(layer_name, infra_id, view)
    });
    let matching_keys = keys(redis, &format!("{prefix}.*")).await?;
    let number_of_deleted_keys = delete(redis, matching_keys).await?;
    Ok(number_of_deleted_keys)
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

/// Invalidates a infra specific layer zone
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `infra_id` - Infra to on which the layer must be invalidated
/// * `layer_name` - Layer on which invalidation must be done
/// * `zone` - Zone to invalidate
async fn invalidate_layer_zone<C: ConnectionLike>(
    redis: &mut C,
    infra_id: i64,
    layer_name: &str,
    zone: &Zone,
    map_config: &MapLayersConfig,
) -> Result<()> {
    let max_zoom = map_config.max_zoom;
    let max_tiles = map_config.max_tiles;
    let mut affected_tiles: HashMap<String, Vec<Tile>> = HashMap::new();
    for (view_name, bbox) in [("geo", &zone.geo), ("sch", &zone.sch)] {
        if count_tiles(max_zoom, bbox) > max_tiles {
            invalidate_full_layer_cache(redis, infra_id, layer_name, Some(view_name)).await?;
        } else {
            affected_tiles.insert(
                get_view_cache_prefix(layer_name, infra_id, view_name),
                get_tiles_to_invalidate(max_zoom, bbox),
            );
        }
    }
    if !affected_tiles.is_empty() {
        invalidate_cache_tiles(redis, affected_tiles).await?;
    }
    Ok(())
}

/// Invalidates a zone for all map layers
/// If the zone is invalide nothing is done
///
/// # Arguments
///
/// * `redis_pool` - Pool to use to connect to the redis
/// * `layers` - Layers to invalidate
/// * `infra_id` - Infra to on which layers must be invalidated
/// * `zone` - Zone to invalidate
///
/// Panics if fail
pub async fn invalidate_zone<C: ConnectionLike>(
    redis: &mut C,
    layers: &Vec<String>,
    infra_id: i64,
    zone: &Zone,
    map_config: &MapLayersConfig,
) -> Result<()> {
    if zone.is_valid() {
        for layer in layers {
            invalidate_layer_zone(redis, infra_id, layer, zone, map_config).await?;
        }
    }
    Ok(())
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
pub async fn invalidate_all<C: ConnectionLike>(redis: &mut C, layers: &Vec<String>, infra_id: i64) {
    for layer_name in layers {
        let result = invalidate_full_layer_cache(redis, infra_id, layer_name, None).await;
        if result.is_err() {
            panic!("Failed to invalidate map layer: {}", result.unwrap_err());
        }
    }
}
