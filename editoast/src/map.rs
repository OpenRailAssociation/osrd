use deadpool_redis::redis::AsyncCommands;

use crate::error::Result;

pub fn get_layer_cache_prefix(
    layer_name: &str,
    infra_id: i64,
    app_version: Option<&str>,
) -> String {
    let version = app_version.unwrap_or("default");
    format!("editoast.{version}.layer.{layer_name}.infra_{infra_id}")
}

pub fn get_view_cache_prefix<T1, T2>(
    layer_name: T1,
    infra_id: i64,
    view_name: T2,
    app_version: Option<&str>,
) -> String
where
    T1: AsRef<str>,
    T2: AsRef<str>,
{
    format!(
        "{layer_prefix}.{view_name}",
        layer_prefix = get_layer_cache_prefix(layer_name.as_ref(), infra_id, app_version),
        view_name = view_name.as_ref()
    )
}

pub fn get_cache_tile_key(view_prefix: &str, (x, y, z): (u64, u64, u64)) -> String {
    format!("{view_prefix}.tile/{z}/{x}/{y}")
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_layer_cache_prefix() {
        assert_eq!(
            get_layer_cache_prefix("track_sections", 1, None),
            "editoast.default.layer.track_sections.infra_1"
        );
    }

    #[test]
    fn test_get_view_cache_prefix() {
        assert_eq!(
            get_view_cache_prefix("track_sections", 1, "geo", None),
            "editoast.default.layer.track_sections.infra_1.geo"
        );
    }

    #[test]
    fn test_get_cache_tile_key() {
        assert_eq!(
            get_cache_tile_key("editoast.default.layer.track_sections.infra_1", (1, 2, 3)),
            "editoast.default.layer.track_sections.infra_1.tile/3/1/2"
        );
    }
}
