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
pub struct Catenary {
    #[derivative(Default(value = r#"generate_id("catenary")"#))]
    pub id: String,
    pub voltage: f64,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

impl OSRDObject for Catenary {
    fn get_type(&self) -> ObjectType {
        ObjectType::Catenary
    }

    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Layer for Catenary {
    fn get_table_name() -> &'static str {
        "osrd_infra_catenarylayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_catenary_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_catenary_layer.sql")
    }

    fn layer_name() -> &'static str {
        "catenaries"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Catenary
    }
}
