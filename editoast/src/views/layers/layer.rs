use crate::api_error::ApiResult;
use crate::chartos::{Layer, MapLayers};
use crate::client::MapLayersConfig;
use rocket::serde::json::{json, Value as JsonValue};

use rocket::State;

use rocket::http::Status;
use thiserror::Error;

use crate::api_error::ApiError;

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
    infra: i32,
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
        "{root_url}/tile/{layer_slug}/{view_slug}/{{z}}/{{x}}/{{y}}/?infra={infra}",
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
                "tiles": ["http://localhost:8090/tile/track_sections/geo/{z}/{x}/{y}/?infra=2"],
                "attribution": "",
                "minzoom": 0,
                "maxzoom": 18
            }),
        );
    }
}
