use crate::client::get_app_version;

/// Web mercator coordinates
#[derive(Debug, Clone, Copy)]
pub struct Tile {
    pub x: u64,
    pub y: u64,
    pub z: u64,
}

pub fn get_layer_cache_prefix(layer_name: &str, infra_id: i64) -> String {
    let version = get_app_version().unwrap_or("default".into());
    format!("editoast.{version}.layer.{layer_name}.infra_{infra_id}")
}

pub fn get_view_cache_prefix<T1, T2>(layer_name: T1, infra_id: i64, view_name: T2) -> String
where
    T1: AsRef<str>,
    T2: AsRef<str>,
{
    format!(
        "{layer_prefix}.{view_name}",
        layer_prefix = get_layer_cache_prefix(layer_name.as_ref(), infra_id),
        view_name = view_name.as_ref()
    )
}

pub fn get_cache_tile_key(view_prefix: &str, tile: &Tile) -> String {
    format!("{view_prefix}.tile/{}/{}/{}", tile.z, tile.x, tile.y)
}

#[cfg(test)]
mod tests {

    use super::get_cache_tile_key;
    use super::get_layer_cache_prefix;
    use super::get_view_cache_prefix;
    use super::Tile;

    #[test]
    fn test_get_layer_cache_prefix() {
        assert_eq!(
            get_layer_cache_prefix("track_sections", 1),
            "editoast.default.layer.track_sections.infra_1"
        );
    }

    #[test]
    fn test_get_view_cache_prefix() {
        assert_eq!(
            get_view_cache_prefix("track_sections", 1, "geo"),
            "editoast.default.layer.track_sections.infra_1.geo"
        );
    }

    #[test]
    fn test_get_cache_tile_key() {
        assert_eq!(
            get_cache_tile_key(
                "editoast.default.layer.track_sections.infra_1",
                &Tile { x: 1, y: 2, z: 3 }
            ),
            "editoast.default.layer.track_sections.infra_1.tile/3/1/2"
        );
    }
}
