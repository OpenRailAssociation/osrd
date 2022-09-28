use std::collections::HashMap;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

use super::generate_id;
use super::OSRDObject;
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
    pub switch_type: String,
    pub group_change_delay: f64,
    pub ports: HashMap<String, TrackEndpoint>,
    pub extensions: SwitchExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SwitchExtensions {
    sncf: Option<SwitchSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SwitchSncfExtension {
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

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SwitchCache {
    pub obj_id: String,
    pub switch_type: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub ports: HashMap<String, TrackEndpoint>,
}

impl SwitchCache {
    pub fn new(obj_id: String, switch_type: String, ports: HashMap<String, TrackEndpoint>) -> Self {
        Self {
            obj_id,
            switch_type,
            ports,
        }
    }
}

impl From<Switch> for SwitchCache {
    fn from(switch: Switch) -> Self {
        Self::new(switch.id, switch.switch_type, switch.ports)
    }
}

impl OSRDObject for SwitchCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }

    fn get_type(&self) -> ObjectType {
        ObjectType::Switch
    }
}

impl Cache for SwitchCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.ports.iter().map(|port| &port.1.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Switch(self.clone())
    }
}
