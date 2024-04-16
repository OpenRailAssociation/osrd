use derivative::Derivative;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDTyped;
use editoast_schemas::primitives::ObjectType;
use std::collections::HashMap;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::Switch;

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
        Self::new(
            switch.id.0,
            switch.switch_type.0,
            switch.ports.into_iter().map(|(k, v)| (k.0, v)).collect(),
        )
    }
}

impl OSRDTyped for SwitchCache {
    fn get_type() -> ObjectType {
        ObjectType::Switch
    }
}

impl OSRDIdentified for SwitchCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for SwitchCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.ports.iter().map(|port| &*port.1.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Switch(self.clone())
    }
}
