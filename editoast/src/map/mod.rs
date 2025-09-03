mod layer_cache;
mod layers;

use deadpool_redis::redis::AsyncCommands;
pub use layers::Layer;
pub use layers::MapLayers;
pub use layers::View;

pub use self::layer_cache::get_cache_tile_key;
pub use self::layer_cache::get_layer_cache_prefix;
pub use self::layer_cache::get_view_cache_prefix;
use crate::error::Result;

/// Invalidates layer cache for a specific infra and view if provided
///
/// # Arguments
///
/// * `valkey` - Pool to use to connect to the valkey
/// * `infra_id` - Infra on which the layer must be invalidated
/// * `layer_name` - Layer to invalidate
/// * `app_version` - Application version for cache key generation
///
/// Returns the number of deleted keys
async fn invalidate_full_layer_cache(
    valkey: &mut cache::Connection,
    infra_id: i64,
    layer_name: &str,
    app_version: Option<&str>,
) -> Result<u64> {
    let prefix: String = get_layer_cache_prefix(layer_name, infra_id, app_version);
    let matching_keys: Vec<String> = valkey.keys(format!("{prefix}.*")).await?;
    if matching_keys.is_empty() {
        return Ok(0);
    }
    let number_of_deleted_keys = valkey.del(matching_keys).await?;
    Ok(number_of_deleted_keys)
}

/// Invalidates all map layers of a specific infra
///
/// # Arguments
///
/// * `valkey` - Pool to use to connect to the valkey
/// * `layers` - Layers to invalidate
/// * `infra_id` - Infra to on which layers must be invalidated
/// * `app_version` - Application version for cache key generation
///
/// Panics if fail
pub async fn invalidate_all(
    valkey: &mut cache::Connection,
    layers: &Vec<String>,
    infra_id: i64,
    app_version: Option<&str>,
) -> Result<()> {
    for layer_name in layers {
        invalidate_full_layer_cache(valkey, infra_id, layer_name, app_version).await?;
    }
    Ok(())
}
