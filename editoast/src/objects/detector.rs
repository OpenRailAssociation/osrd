use crate::layer::Layer;

use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Detector {
    #[derivative(Default(value = r#"generate_id("detector")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
}

impl OSRDObject for Detector {
    fn get_type(&self) -> ObjectType {
        ObjectType::Detector
    }

    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Layer for Detector {
    fn get_table_name() -> &'static str {
        "osrd_infra_detectorlayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_detector_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_update_detector_layer.sql")
    }

    fn layer_name() -> &'static str {
        "detectors"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Detector
    }
}
