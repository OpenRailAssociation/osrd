use crate::api_error::ApiResult;
use crate::chartos::{get, get_cache_tile_key, get_view_cache_prefix, set, Layer, MapLayers, Tile};
use crate::client::MapLayersConfig;
use crate::db_connection::{DBConnection, RedisPool};
use diesel::sql_types::Integer;
use diesel::{sql_query, RunQueryDsl};
use rocket::serde::json::{json, Value as JsonValue};
use rocket::State;

use rocket::http::Status;
use thiserror::Error;

use crate::api_error::ApiError;

use super::mvt_utils::{create_and_fill_mvt_tile, get_geo_json_sql_query, GeoJsonAndData};

#[derive(Debug, Error)]
enum LayersError {
    #[error("Layer {} not found. Expected one of {:?}", .layer_name, .expected_names)]
    LayerNotFound {
        layer_name: String,
        expected_names: Vec<String>,
    },
    #[error("View {} not found. Expected one of {:?}", .view_name, .expected_names)]
    ViewNotFound {
        view_name: String,
        expected_names: Vec<String>,
    },
}

impl ApiError for LayersError {
    fn get_status(&self) -> Status {
        Status::NotFound
    }

    fn get_type(&self) -> &'static str {
        match self {
            LayersError::LayerNotFound { .. } => "editoast:layers:LayerNotFound",
            LayersError::ViewNotFound { .. } => "editoast:layers:ViewNotFound",
        }
    }
}

impl LayersError {
    pub fn new_layer_not_found<T: AsRef<str>>(name: T, map_layers: &MapLayers) -> Self {
        let mut expected_names: Vec<_> = map_layers.layers.keys().cloned().collect();
        expected_names.sort();
        Self::LayerNotFound {
            layer_name: name.as_ref().to_string(),
            expected_names,
        }
    }
    pub fn new_view_not_found<T: AsRef<str>>(name: T, layer: &Layer) -> Self {
        let mut expected_names: Vec<_> = layer.views.keys().cloned().collect();
        expected_names.sort();
        Self::ViewNotFound {
            view_name: name.as_ref().to_string(),
            expected_names,
        }
    }
}

/// Returns layer view metadata to query tiles
#[get("/layer/<layer_slug>/mvt/<view_slug>?<infra>")]
pub async fn layer_view(
    layer_slug: &str,
    view_slug: &str,
    infra: i64,
    map_layers: &State<MapLayers>,
    map_layers_config: &State<MapLayersConfig>,
) -> ApiResult<JsonValue> {
    let layer = match map_layers.layers.get(layer_slug) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug, map_layers).into()),
    };

    if !layer.views.contains_key(view_slug) {
        return Err(LayersError::new_view_not_found(view_slug, layer).into());
    }

    let tiles_url_pattern = format!(
        "{root_url}/layers/tile/{layer_slug}/{view_slug}/{{z}}/{{x}}/{{y}}/?infra={infra}",
        root_url = map_layers_config.root_url
    );

    Ok(json!({
        "type": "vector",
        "name": layer_slug,
        "promoteId": {layer_slug: layer.id_field},
        "scheme": "xyz",
        "tiles": [tiles_url_pattern],
        "attribution": layer.attribution.clone().unwrap_or_default(),
        "minzoom": 0,
        "maxzoom": map_layers_config.max_zoom,
    }))
}

/// Gets mvt tile from the cache if possible, otherwise gets data fro the data base and caches it in redis
#[get(
    "/tile/<layer_slug>/<view_slug>/<z>/<x>/<y>?<infra>",
    format = "application/octet-stream"
)]
#[allow(clippy::too_many_arguments)]
pub async fn cache_and_get_mvt_tile<'a>(
    layer_slug: &str,
    view_slug: &str,
    z: u64,
    x: u64,
    y: u64,
    infra: i64,
    map_layers: &State<MapLayers>,
    conn: DBConnection,
    pool: &RedisPool,
) -> ApiResult<Vec<u8>> {
    let layer = match map_layers.layers.get(layer_slug) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug, map_layers).into()),
    };
    let view = match layer.views.get(view_slug) {
        Some(view) => view,
        None => return Err(LayersError::new_view_not_found(view_slug, layer).into()),
    };
    let cache_key = get_cache_tile_key(
        &get_view_cache_prefix(layer_slug, infra, view_slug),
        &Tile { x, y, z },
    );
    let cached_value = get::<Vec<u8>>(pool, &cache_key).await;

    if let Some(value) = cached_value {
        return Ok(value);
    }

    let geo_json_query = get_geo_json_sql_query(&layer.table_name, view);
    let records = conn
        .run::<_, ApiResult<_>>(move |conn| {
            match sql_query(geo_json_query)
                .bind::<Integer, _>(z as i32)
                .bind::<Integer, _>(x as i32)
                .bind::<Integer, _>(y as i32)
                .bind::<Integer, _>(infra as i32)
                .get_results::<GeoJsonAndData>(conn)
            {
                Ok(results) => Ok(results),
                Err(err) => Err(err.into()),
            }
        })
        .await?;
    let mvt_bytes: Vec<u8> = create_and_fill_mvt_tile(z, x, y, layer_slug, records)
        .to_bytes()
        .unwrap();
    set(pool, &cache_key, mvt_bytes.clone())
        .await
        .unwrap_or_else(|_| panic!("Fail to set value in redis with key {cache_key}"));
    Ok(mvt_bytes)
}

#[cfg(test)]
mod tests {
    use crate::views::tests::create_test_client;
    use rocket::http::Status;
    use rocket::serde::json::{json, Value as JsonValue};

    fn test_query(uri: &str, status: Status, expected_body: JsonValue) {
        let client = create_test_client();
        let response = client.get(uri).dispatch();
        assert_eq!(response.status().clone(), status);
        let body: JsonValue =
            serde_json::from_str(response.into_string().unwrap().as_str()).unwrap();
        assert_eq!(expected_body, body)
    }

    #[test]
    fn layer_view() {
        test_query(
            "/layers/layer/track_sections/mvt/does_not_exist?infra=2",
            Status::NotFound,
            json!({
                "message": "View does_not_exist not found. Expected one of [\"geo\", \"sch\"]",
                "osrd_error_type": "editoast:layers:ViewNotFound"
            }),
        );
        test_query(
            "/layers/layer/track_sections/mvt/geo?infra=2",
            Status::Ok,
            json!({
                "type": "vector",
                "name": "track_sections",
                "promoteId": {
                    "track_sections": "id"
                },
                "scheme": "xyz",
                "tiles": ["http://localhost:8090/layers/tile/track_sections/geo/{z}/{x}/{y}/?infra=2"],
                "attribution": "",
                "minzoom": 0,
                "maxzoom": 18
            }),
        );
    }
}
