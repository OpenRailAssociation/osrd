mod info;
mod mvt_utils;

use crate::client::MapLayersConfig;
use crate::error::{EditoastError, Result};
use crate::map::{get, get_cache_tile_key, get_view_cache_prefix, set, Layer, MapLayers, Tile};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::http::StatusCode;
use actix_web::web::{block, scope, Data, Json, Path, Query};
use actix_web::{get, HttpResponse};
use diesel::sql_types::Integer;
use diesel::{sql_query, RunQueryDsl};
use info::info_route;
use mvt_utils::{create_and_fill_mvt_tile, get_geo_json_sql_query, GeoJsonAndData};
use redis::Client;
use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use thiserror::Error;

/// Returns `/layers` routes
pub fn routes() -> impl HttpServiceFactory {
    scope("/layers").service((info_route, layer_view, cache_and_get_mvt_tile))
}

#[derive(Debug, Error)]
enum LayersError {
    #[error("Layer '{}' not found. Expected one of {:?}", .layer_name, .expected_names)]
    LayerNotFound {
        layer_name: String,
        expected_names: Vec<String>,
    },
    #[error("View '{}' not found. Expected one of {:?}", .view_name, .expected_names)]
    ViewNotFound {
        view_name: String,
        expected_names: Vec<String>,
    },
}

impl EditoastError for LayersError {
    fn get_status(&self) -> StatusCode {
        StatusCode::NOT_FOUND
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

#[derive(Deserialize, Debug, Clone)]
struct InfraQueryParam {
    infra: i64,
}

/// Returns layer view metadata to query tiles
#[get("/layer/{layer_slug}/mvt/{view_slug}")]
async fn layer_view(
    path: Path<(String, String)>,
    params: Query<InfraQueryParam>,
    map_layers: Data<MapLayers>,
    map_layers_config: Data<MapLayersConfig>,
) -> Result<Json<JsonValue>> {
    let (layer_slug, view_slug) = path.into_inner();
    let infra = params.infra;
    let layer = match map_layers.layers.get(&layer_slug) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug, &map_layers).into()),
    };

    if !layer.views.contains_key(&view_slug) {
        return Err(LayersError::new_view_not_found(view_slug, layer).into());
    }

    let tiles_url_pattern = format!(
        "{root_url}/layers/tile/{layer_slug}/{view_slug}/{{z}}/{{x}}/{{y}}/?infra={infra}",
        root_url = map_layers_config.root_url
    );

    Ok(Json(json!({
        "type": "vector",
        "name": layer_slug,
        "promoteId": {layer_slug: layer.id_field},
        "scheme": "xyz",
        "tiles": [tiles_url_pattern],
        "attribution": layer.attribution.clone().unwrap_or_default(),
        "minzoom": 0,
        "maxzoom": map_layers_config.max_zoom,
    })))
}

/// Gets mvt tile from the cache if possible, otherwise gets data fro the data base and caches it in redis
#[get("/tile/{layer_slug}/{view_slug}/{z}/{x}/{y}")]
async fn cache_and_get_mvt_tile(
    path: Path<(String, String, u64, u64, u64)>,
    params: Query<InfraQueryParam>,
    map_layers: Data<MapLayers>,
    db_pool: Data<DbPool>,
    redis_client: Data<Client>,
) -> Result<HttpResponse> {
    let (layer_slug, view_slug, z, x, y) = path.into_inner();
    let infra = params.infra;
    let layer = match map_layers.layers.get(&layer_slug) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug, &map_layers).into()),
    };
    let view = match layer.views.get(&view_slug) {
        Some(view) => view,
        None => return Err(LayersError::new_view_not_found(view_slug, layer).into()),
    };
    let cache_key = get_cache_tile_key(
        &get_view_cache_prefix(&layer_slug, infra, &view_slug),
        &Tile { x, y, z },
    );

    let mut redis_conn = redis_client.get_tokio_connection_manager().await.unwrap();
    let cached_value = get::<Vec<u8>>(&mut redis_conn, &cache_key).await;

    if let Some(value) = cached_value {
        return Ok(HttpResponse::Ok()
            .content_type("application/x-protobuf")
            .body(value));
    }

    let geo_json_query = get_geo_json_sql_query(&layer.table_name, view);
    let records = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Fail to get DB connection");
        match sql_query(geo_json_query)
            .bind::<Integer, _>(z as i32)
            .bind::<Integer, _>(x as i32)
            .bind::<Integer, _>(y as i32)
            .bind::<Integer, _>(infra as i32)
            .get_results::<GeoJsonAndData>(&mut conn)
        {
            Ok(results) => Ok(results),
            Err(err) => Err(err.into()),
        }
    })
    .await
    .unwrap()?;

    let mvt_bytes: Vec<u8> = create_and_fill_mvt_tile(z, x, y, layer_slug, records)
        .to_bytes()
        .unwrap();
    set(&mut redis_conn, &cache_key, mvt_bytes.clone())
        .await
        .unwrap_or_else(|_| panic!("Fail to set value in redis with key {cache_key}"));
    Ok(HttpResponse::Ok()
        .content_type("application/x-protobuf")
        .body(mvt_bytes))
}

#[cfg(test)]
mod tests {
    use crate::error::InternalError;
    use crate::map::MapLayers;
    use crate::views::tests::create_test_service;
    use actix_web::test as actix_test;
    use actix_web::{
        http::StatusCode,
        test::{call_service, read_body_json, TestRequest},
    };
    use serde_json::{json, to_value, Value as JsonValue};

    use super::LayersError;

    /// Run a simple get query on `uri` and check the status code and json body
    async fn test_get_query(uri: &str, expected_status: StatusCode, expected_body: JsonValue) {
        let app = create_test_service().await;
        let req = TestRequest::get().uri(uri).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), expected_status);
        let body: JsonValue = read_body_json(response).await;
        assert_eq!(expected_body, body)
    }

    #[actix_test]
    async fn layer_view() {
        let map_layers = MapLayers::parse();
        let error: InternalError =
            LayersError::new_view_not_found("does_not_exist", &map_layers.layers["track_sections"])
                .into();
        test_get_query(
            "/layers/layer/track_sections/mvt/does_not_exist?infra=2",
            StatusCode::NOT_FOUND,
            to_value(error).unwrap(),
        )
        .await;

        test_get_query(
            "/layers/layer/track_sections/mvt/geo?infra=2",
            StatusCode::OK,
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
        ).await;
    }
}
