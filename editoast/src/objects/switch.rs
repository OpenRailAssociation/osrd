use std::collections::HashMap;

use crate::layer::Layer;

use super::generate_id;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use super::TrackEndpoint;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Switch {
    #[derivative(Default(value = r#"generate_id("switch")"#))]
    pub id: String,
    pub switch_type: ObjectRef,
    pub group_change_delay: f64,
    pub ports: HashMap<String, TrackEndpoint>,
    pub label: String,
}

impl OSRDObject for Switch {
    fn get_id(&self) -> &String {
        &self.id
    }

    fn get_type(&self) -> ObjectType {
        ObjectType::Switch
    }
}

impl Layer for Switch {
    fn get_table_name() -> &'static str {
        "osrd_infra_switchlayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_switch_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_update_switch_layer.sql")
    }

    fn layer_name() -> &'static str {
        "switches"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Switch
    }
}
