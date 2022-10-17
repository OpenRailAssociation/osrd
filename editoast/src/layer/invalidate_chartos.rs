use super::InvalidationZone;
use crate::client::ChartosConfig;
use serde_json::json;

/// Invalidate a whole chartos layer cache.
pub fn invalidate_chartos_layer(infra_id: i32, layer_slug: &str, chartos_config: &ChartosConfig) {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!(
            "{}layer/{}/invalidate/?infra={}",
            chartos_config.url(),
            layer_slug,
            infra_id
        ))
        .bearer_auth(&chartos_config.chartos_token)
        .send()
        .expect("Failed to send invalidate request to chartos");
    if !resp.status().is_success() {
        panic!("Failed to invalidate chartos layer: {}", resp.status());
    }
}

/// Invalidate a part of chartos layer cache.
pub fn invalidate_bbox_chartos_layer(
    infra_id: i32,
    layer_slug: &str,
    invalidation: &InvalidationZone,
    chartos_config: &ChartosConfig,
) {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!(
            "{}layer/{}/invalidate_bbox/?infra={}",
            chartos_config.url(),
            layer_slug,
            infra_id
        ))
        .json(&json!([
            {
                "view": "geo",
                "bbox": invalidation.geo,
            },
            {
                "view": "sch",
                "bbox": invalidation.sch,
            }
        ]))
        .bearer_auth(&chartos_config.chartos_token)
        .send()
        .expect("Failed to send invalidate request to chartos");
    if !resp.status().is_success() {
        panic!("Failed to invalidate chartos layer: {}", resp.status());
    }
}
