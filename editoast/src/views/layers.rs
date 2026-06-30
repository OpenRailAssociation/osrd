use std::collections::HashMap;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::header::CONTENT_ENCODING;
use axum::http::header::CONTENT_TYPE;
use axum::response::IntoResponse;
use deadpool_redis::redis::AsyncCommands;
use editoast_derive::EditoastError;
use flate2::Compression;
use flate2::write::GzEncoder;
use serde::Deserialize;
use serde::Serialize;
use std::io::Write;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::map::get_cache_tile_key;
use crate::map::get_view_cache_prefix;
use editoast_models::map::ALLOWED_VIEWS;
use editoast_models::map::GeoJsonAndData;
use editoast_models::map::MAP_LAYER_NAMES;
use editoast_models::map::MAP_LAYERS;
use editoast_models::map::create_and_fill_mvt_tile;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "layers", default_status = 404)]
enum LayersError {
    #[error("Layer '{}' not found. Expected one of {:?}", .layer_name, .expected_names)]
    LayerNotFound {
        layer_name: String,
        expected_names: Vec<&'static str>,
    },
    #[error("View '{}' not found. Expected one of {:?}", .view_name, .expected_names)]
    ViewNotFound {
        view_name: String,
        expected_names: Vec<&'static str>,
    },
}

impl LayersError {
    pub fn new_layer_not_found<T: AsRef<str>>(name: T) -> Self {
        Self::LayerNotFound {
            layer_name: name.as_ref().to_string(),
            expected_names: MAP_LAYER_NAMES.clone(),
        }
    }
    pub fn new_view_not_found<T: AsRef<str>>(name: T) -> Self {
        Self::ViewNotFound {
            view_name: name.as_ref().to_string(),
            expected_names: ALLOWED_VIEWS.to_vec(),
        }
    }
}

#[derive(Deserialize, Debug, Clone, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct InfraQueryParam {
    infra: i64,
}

#[derive(Deserialize, IntoParams)]
#[allow(unused)]
struct LayerViewParams {
    layer_slug: String,
    view_slug: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub(in crate::views) struct ViewMetadata {
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
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "layers",
    params(InfraQueryParam, LayerViewParams),
    responses(
        (status = 200, body = inline(ViewMetadata), description = "Successful Response"),
    )
)]
pub(in crate::views) async fn layer_view(
    State(AppState { config, .. }): State<AppState>,
    Path((layer_slug, view_slug)): Path<(String, String)>,
    Query(InfraQueryParam { infra: infra_id }): Query<InfraQueryParam>,
) -> Result<Json<ViewMetadata>> {
    let layer = match MAP_LAYERS.layers.get(layer_slug.as_str()) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug).into()),
    };

    if !ALLOWED_VIEWS.contains(&view_slug.as_str()) {
        return Err(LayersError::new_view_not_found(view_slug).into());
    }

    let mut root_url = config.root_url.clone();
    if !root_url.path().ends_with('/') {
        root_url.path_segments_mut().unwrap().push(""); // Add a trailing slash
    }
    let root_url = root_url.to_string();
    let tiles_url_pattern = format!(
        "{root_url}layers/tile/{layer_slug}/{view_slug}/{{z}}/{{x}}/{{y}}/?infra={infra_id}"
    );

    Ok(Json(ViewMetadata {
        data_type: "vector".to_owned(),
        name: layer_slug.to_owned(),
        promote_id: HashMap::from([(
            layer_slug,
            layer.id_field.map(|s| s.to_string()).unwrap_or_default(),
        )]),
        scheme: "xyz".to_owned(),
        tiles: vec![tiles_url_pattern],
        attribution: layer.attribution.map(|s| s.to_string()).unwrap_or_default(),
        minzoom: 5,
        maxzoom: config.map_layers_max_zoom as u64,
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

/// Mvt tile from the cache if possible, otherwise gets data from the database and caches it in valkey
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "layers",
    params(InfraQueryParam, TileParams),
    responses(
        (status = 200, content_type = "application/octet-stream", body = String),
    )
)]
pub(in crate::views) async fn cache_and_get_mvt_tile(
    State(AppState {
        db_pool,
        valkey_client,
        config,
        ..
    }): State<AppState>,
    Path((layer_slug, view_slug, z, x, y)): Path<(String, String, u64, u64, u64)>,
    Query(InfraQueryParam { infra: infra_id }): Query<InfraQueryParam>,
) -> Result<impl IntoResponse> {
    let layer = match MAP_LAYERS.layers.get(layer_slug.as_str()) {
        Some(layer) => layer,
        None => return Err(LayersError::new_layer_not_found(layer_slug).into()),
    };
    let view = layer
        .get_view(view_slug.as_str())
        .ok_or_else(|| LayersError::new_view_not_found(view_slug.clone()))?;

    let cache_key = get_cache_tile_key(
        &get_view_cache_prefix(
            &layer_slug,
            infra_id,
            &view_slug,
            config.app_version.as_deref(),
        ),
        (x, y, z),
    );

    let cached_value: Option<Vec<u8>> = {
        let mut valkey = valkey_client.get_connection().await?;
        valkey.get(&cache_key).await?
    };

    if let Some(value) = cached_value {
        return Ok((
            [
                (CONTENT_TYPE, "application/x-protobuf"),
                (CONTENT_ENCODING, "gzip"),
            ],
            value,
        ));
    }

    let conn = &mut db_pool.get().await?;
    let records = GeoJsonAndData::get_records(conn, layer, view, infra_id, (x, y, z)).await?;

    let mvt_bytes: Vec<u8> = create_and_fill_mvt_tile(layer_slug, records)
        .to_bytes()
        .unwrap();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
    encoder
        .write_all(&mvt_bytes)
        .expect("Failed to write MVT bytes to GzEncoder");
    let compressed_mvt = encoder.finish().unwrap();

    let mut valkey = valkey_client.get_connection().await?;
    valkey
        .set::<_, _, ()>(&cache_key, compressed_mvt.clone())
        .await
        .unwrap_or_else(|_| panic!("Failed to set value in valkey with key {cache_key}"));

    Ok((
        [
            (CONTENT_TYPE, "application/x-protobuf"),
            (CONTENT_ENCODING, "gzip"),
        ],
        compressed_mvt,
    ))
}

#[cfg(test)]
mod tests {
    use rstest::rstest;
    use std::collections::HashMap;
    use url::Url;

    use super::LayersError;
    use super::ViewMetadata;
    use crate::error::InternalError;
    use crate::views::test_app;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn layer_error_view_not_found() {
        let error: InternalError = LayersError::new_view_not_found("does_not_exist").into();

        let app = test_app!().skip_authz().build();
        let body: InternalError = app
            .get("/layers/layer/track_sections/mvt/does_not_exist?infra=2")
            .await
            .assert_status_not_found()
            .json();
        assert_eq!(body, error);
    }

    #[rstest]
    #[case("http://localhost:8090", "http://localhost:8090/")]
    #[case("http://localhost:8090/", "http://localhost:8090/")]
    #[case("http://localhost:8090/test", "http://localhost:8090/test/")]
    #[case("http://localhost:8090/test/", "http://localhost:8090/test/")]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn layer_success(#[case] root_url: &str, #[case] expected_root_url: &str) {
        let root_url = Url::parse(root_url).unwrap();
        let expected_root_url = Url::parse(expected_root_url).unwrap();

        let tiles =
            format!("{expected_root_url}layers/tile/track_sections/geo/{{z}}/{{x}}/{{y}}/?infra=2");
        let expected_body = ViewMetadata {
            data_type: "vector".to_string(),
            name: "track_sections".to_string(),
            promote_id: HashMap::from([("track_sections".to_string(), "id".to_string())]),
            scheme: "xyz".to_string(),
            tiles: vec![tiles],
            attribution: "".to_string(),
            minzoom: 5,
            maxzoom: 18,
        };

        let app = test_app!().root_url(root_url).skip_authz().build();
        let body: ViewMetadata = app
            .get("/layers/layer/track_sections/mvt/geo?infra=2")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(expected_body, body);
    }
}
