mod bounding_box;
mod layer_cache;
mod map_layers;

pub use bounding_box::{BoundingBox, InvalidationZone};
pub use map_layers::{Layer, MapLayers};

use reqwest::Client;
use serde_json::json;

use crate::client::ChartosConfig;

const LAYERS: [&str; 12] = [
    "track_sections",
    "signals",
    "speed_sections",
    "track_section_links",
    "switches",
    "detectors",
    "buffer_stops",
    "routes",
    "operational_points",
    "catenaries",
    "lpv_panels",
    "errors",
];

/// Invalidate a zone for all chartos layers
/// If the zone is invalide nothing is done
pub async fn invalidate_zone(
    infra_id: i64,
    chartos_config: &ChartosConfig,
    zone: &InvalidationZone,
) {
    if !zone.is_valid() {
        return;
    }

    for layer in LAYERS {
        invalidate_layer_zone(infra_id, layer, zone, chartos_config).await;
    }
}

/// Invalidate all chartos layers
pub async fn invalidate_all(infra_id: i64, chartos_config: &ChartosConfig) {
    for layer in LAYERS {
        invalidate_layer(infra_id, layer, chartos_config).await;
    }
}

/// Invalidate a zone of chartos layer
/// Panic if the request failed
async fn invalidate_layer_zone(
    infra_id: i64,
    layer: &str,
    zone: &InvalidationZone,
    chartos_config: &ChartosConfig,
) {
    let resp = Client::new()
        .post(format!(
            "{}layer/{}/invalidate_bbox/?infra={}",
            chartos_config.url(),
            layer,
            infra_id
        ))
        .json(&json!([
            {
                "view": "geo",
                "bbox": zone.geo,
            },
            {
                "view": "sch",
                "bbox": zone.sch,
            }
        ]))
        .bearer_auth(&chartos_config.chartos_token)
        .send()
        .await
        .expect("Failed to send invalidate request to chartos");
    if !resp.status().is_success() {
        panic!("Failed to invalidate chartos layer: {}", resp.status());
    }
}

/// Invalidate a whole chartos layer
/// Panic if the request failed
async fn invalidate_layer(infra_id: i64, layer: &str, chartos_config: &ChartosConfig) {
    let resp = Client::new()
        .post(format!(
            "{}layer/{}/invalidate/?infra={}",
            chartos_config.url(),
            layer,
            infra_id
        ))
        .bearer_auth(&chartos_config.chartos_token)
        .send()
        .await
        .expect("Failed to send invalidate request to chartos");
    if !resp.status().is_success() {
        panic!("Failed to invalidate chartos layer: {}", resp.status());
    }
}
