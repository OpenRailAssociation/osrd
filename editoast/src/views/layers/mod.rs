mod mvt_utils;

use std::collections::HashMap;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::HttpResponse;
use diesel::sql_query;
use diesel::sql_types::Integer;
use diesel_async::RunQueryDsl;
use editoast_derive::EditoastError;
use mvt_utils::create_and_fill_mvt_tile;
use mvt_utils::get_geo_json_sql_query;
use mvt_utils::GeoJsonAndData;
use redis::AsyncCommands;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::client::get_root_url;
use crate::client::MapLayersConfig;
use crate::error::Result;
use crate::map::get_cache_tile_key;
use crate::map::get_view_cache_prefix;
use crate::map::Layer;
use crate::map::MapLayers;
use crate::map::Tile;
use crate::RedisClient;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
     "/layers" => {
        "/layer/{layer_slug}/mvt/{view_slug}" => {
            layer_view,
        },
        "/tile/{layer_slug}/{view_slug}/{z}/{x}/{y}" => {
            cache_and_get_mvt_tile,
        },
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "layers", default_status = 404)]
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

#[derive(Deserialize, Debug, Clone, IntoParams)]
#[into_params(parameter_in = Query)]
struct InfraQueryParam {
    infra: i64,
}

#[derive(Deserialize, IntoParams)]
#[allow(unused)]
struct LayerViewParams {
    layer_slug: String,
    view_slug: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
struct ViewMetadata {
    #[serde(rename = "type")]
    data_type: String,
    #[schema(example = "track_sections")]
    name: String,
    #[serde(rename = "promoteId")]
    #[schema(value_type = HashMap<String, String>)]
    promote_id: HashMap<String, String>,
    #[schema(example = "xyz")]
    scheme: String,
    #[schema(example = json!(["http://localhost:7070/tile/track_sections/geo/{z}/{x}/{y}/?infra=1"]))]
    tiles: Vec<String>,
    attribution: String,
    minzoom: u64,
    #[schema(example = 15)]
    maxzoom: u64,
}

/// Returns layer view metadata to query tiles
#[utoipa::path(
    tag = "layers",
    params(InfraQueryParam, LayerViewParams),
    responses(
        (status = 200, body = inline(ViewMetadata), description = "Successful Response"),
    )
)]
#[get("")]
async fn layer_view(
    path: Path<(String, String)>,
    params: Query<InfraQueryParam>,
    map_layers: Data<MapLayers>,
    map_layers_config: Data<MapLayersConfig>,
) -> Result<Json<ViewMetadata>> {
    let (layer_slug, view_slug) = path.into_inner();
    let infra = params.infra;
    let layer = match map_layers.layers.get(&layer_slug) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug, &map_layers).into()),
    };

    if !layer.views.contains_key(&view_slug) {
        return Err(LayersError::new_view_not_found(view_slug, layer).into());
    }

    let mut root_url = get_root_url()?;
    if !root_url.path().ends_with('/') {
        root_url.path_segments_mut().unwrap().push(""); // Add a trailing slash
    }
    let root_url = root_url.to_string();
    let tiles_url_pattern =
        format!("{root_url}layers/tile/{layer_slug}/{view_slug}/{{z}}/{{x}}/{{y}}/?infra={infra}");

    Ok(Json(ViewMetadata {
        data_type: "vector".to_owned(),
        name: layer_slug.to_owned(),
        promote_id: HashMap::from([(layer_slug, layer.id_field.clone().unwrap_or_default())]),
        scheme: "xyz".to_owned(),
        tiles: vec![tiles_url_pattern],
        attribution: layer.attribution.clone().unwrap_or_default(),
        minzoom: 5,
        maxzoom: map_layers_config.max_zoom,
    }))
}

#[derive(Deserialize, IntoParams)]
#[allow(unused)]
struct TileParams {
    layer_slug: String,
    view_slug: String,
    x: u64,
    y: u64,
    z: u64,
}

/// Mvt tile from the cache if possible, otherwise gets data from the database and caches it in redis
#[utoipa::path(
    tag = "layers",
    params(InfraQueryParam, TileParams),
    responses(
        (status = 200, body = Vec<u8>, description = "Successful Response"),
    )
)]
#[get("")]
async fn cache_and_get_mvt_tile(
    path: Path<(String, String, u64, u64, u64)>,
    params: Query<InfraQueryParam>,
    map_layers: Data<MapLayers>,
    db_pool: Data<DbConnectionPoolV2>,
    redis_client: Data<RedisClient>,
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

    let mut redis = redis_client.get_connection().await?;
    let cached_value: Option<Vec<u8>> = redis
        .get_ex(&cache_key, redis::Expiry::EX(view.cache_duration as usize))
        .await?;

    if let Some(value) = cached_value {
        return Ok(HttpResponse::Ok()
            .content_type("application/x-protobuf")
            .body(value));
    }

    let geo_json_query = get_geo_json_sql_query(&layer.table_name, view);
    let mut conn = db_pool.get().await?;
    let records = sql_query(geo_json_query)
        .bind::<Integer, _>(z as i32)
        .bind::<Integer, _>(x as i32)
        .bind::<Integer, _>(y as i32)
        .bind::<Integer, _>(infra as i32)
        .get_results::<GeoJsonAndData>(&mut conn)
        .await?;

    let mvt_bytes: Vec<u8> = create_and_fill_mvt_tile(layer_slug, records)
        .to_bytes()
        .unwrap();
    redis
        .set_ex(&cache_key, mvt_bytes.clone(), view.cache_duration)
        .await
        .unwrap_or_else(|_| panic!("Fail to set value in redis with key {cache_key}"));
    Ok(HttpResponse::Ok()
        .content_type("application/x-protobuf")
        .body(mvt_bytes))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use actix_web::http::StatusCode;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde::de::DeserializeOwned;
    use serde_json::to_value;

    use super::LayersError;
    use crate::error::InternalError;
    use crate::map::MapLayers;
    use crate::views::layers::ViewMetadata;
    use crate::views::test_app::TestAppBuilder;

    /// Run a simple get query on `uri` and check the status code and json body
    async fn test_get_query<T: DeserializeOwned + PartialEq + std::fmt::Debug>(
        uri: &str,
        expected_status: StatusCode,
        expected_body: T,
    ) {
        let app = TestAppBuilder::default_app();
        let request = TestRequest::get().uri(uri).to_request();
        let body: T = app
            .fetch(request)
            .assert_status(expected_status)
            .json_into();
        assert_eq!(expected_body, body)
    }

    async fn test_get_query_with_preset_values(root_url: &str) {
        let tiles = root_url.to_string() + "layers/tile/track_sections/geo/{z}/{x}/{y}/?infra=2";
        test_get_query(
            "/layers/layer/track_sections/mvt/geo?infra=2",
            StatusCode::OK,
            ViewMetadata {
                data_type: "vector".to_string(),
                name: "track_sections".to_string(),
                promote_id: HashMap::from([("track_sections".to_string(), "id".to_string())]),
                scheme: "xyz".to_string(),
                tiles: vec![tiles],
                attribution: "".to_string(),
                minzoom: 5,
                maxzoom: 18,
            },
        )
        .await;
    }

    #[rstest]
    async fn layer_view_ko() {
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
    }

    #[rstest]
    async fn layer_view_ok() {
        // We can't use #[case] here, for these cases can't run in parallel.
        for (root_url, expected_root_url) in [
            ("http://localhost:8090", "http://localhost:8090/"),
            ("http://localhost:8090/", "http://localhost:8090/"),
            ("http://localhost:8090/test", "http://localhost:8090/test/"),
            ("http://localhost:8090/test/", "http://localhost:8090/test/"),
        ] {
            std::env::set_var("ROOT_URL", root_url);
            test_get_query_with_preset_values(expected_root_url).await;
        }
    }
}
