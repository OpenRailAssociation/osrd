use std::collections::HashMap;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

use super::generate_id;
use super::ApplicableDirectionsTrackRange;
use super::OSRDObject;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SpeedSection {
    #[derivative(Default(value = r#"generate_id("speed_section")"#))]
    pub id: String,
    #[derivative(Default(value = "Some(80.)"))]
    pub speed_limit: Option<f64>,
    pub speed_limit_by_tag: HashMap<String, f64>,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

impl OSRDObject for SpeedSection {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::SpeedSection
    }
}

impl Layer for SpeedSection {
    fn get_table_name() -> &'static str {
        "osrd_infra_speedsectionlayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_speed_section_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_speed_section_layer.sql")
    }

    fn layer_name() -> &'static str {
        "speed_sections"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::SpeedSection
    }
}

impl Cache for SpeedSection {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.track_ranges.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SpeedSection(self.clone())
    }
}
