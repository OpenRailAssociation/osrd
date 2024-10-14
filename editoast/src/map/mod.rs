mod layer_cache;
mod layers;

pub use layers::Layer;
pub use layers::MapLayers;
pub use layers::View;
use redis::AsyncCommands;

pub use self::layer_cache::get_cache_tile_key;
pub use self::layer_cache::get_layer_cache_prefix;
pub use self::layer_cache::get_view_cache_prefix;
pub use self::layer_cache::Tile;
use crate::error::Result;
use crate::ValkeyConnection;

/// Invalidates layer cache for a specific infra and view if provided
///
/// # Arguments
///
/// * `valkey` - Pool to use to connect to the valkey
/// * `infra_id` - Infra on which the layer must be invalidated
/// * `layer_name` - Layer to invalidate
///
/// Returns the number of deleted keys
async fn invalidate_full_layer_cache(
    valkey: &mut ValkeyConnection,
    infra_id: i64,
    layer_name: &str,
) -> Result<u64> {
    let prefix: String = get_layer_cache_prefix(layer_name, infra_id);
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
///
/// Panics if fail
pub async fn invalidate_all(
    valkey: &mut ValkeyConnection,
    layers: &Vec<String>,
    infra_id: i64,
) -> Result<()> {
    for layer_name in layers {
        invalidate_full_layer_cache(valkey, infra_id, layer_name).await?;
    }
    Ok(())
}
