use std::collections::HashMap;

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
    fn get_id(&self) -> String {
        self.id.clone()
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::Switch
    }
}
