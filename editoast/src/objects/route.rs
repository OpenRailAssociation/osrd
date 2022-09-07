use crate::layer::Layer;

use super::generate_id;
use super::DirectionalTrackRange;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: ObjectRef,
    pub exit_point: ObjectRef,
    pub release_detectors: Vec<ObjectRef>,
    pub path: Vec<DirectionalTrackRange>,
}

impl OSRDObject for Route {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::Route
    }
}

impl Layer for Route {
    fn get_table_name() -> &'static str {
        "osrd_infra_routelayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_route_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_route_layer.sql")
    }

    fn layer_name() -> &'static str {
        "routes"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Route
    }
}
