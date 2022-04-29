mod bounding_box;
pub mod errors;
pub mod infra;
mod signal_layer;
mod speed_section_layer;
mod switch_layer;
mod track_section_layer;
mod track_section_link_layer;

pub use bounding_box::{BoundingBox, InvalidationZone};
pub use infra::{CreateInfra, Infra, InfraError};
pub use signal_layer::SignalLayer;
pub use speed_section_layer::SpeedSectionLayer;
pub use switch_layer::SwitchLayer;
pub use track_section_layer::TrackSectionLayer;
pub use track_section_link_layer::TrackSectionLinkLayer;

use rocket_contrib::databases::diesel;

use crate::client::ChartosConfig;

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);

/// Invalidate a whole chartos layer cache.
fn invalidate_chartos_layer(infra_id: i32, layer_slug: &str, chartos_config: &ChartosConfig) {
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
fn invalidate_bbox_chartos_layer(
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
