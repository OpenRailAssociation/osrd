use derivative::Derivative;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDTyped;
use editoast_schemas::primitives::ObjectType;
use std::collections::HashMap;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::TrackNode;

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct TrackNodeCache {
    pub obj_id: String,
    pub track_node_type: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub ports: HashMap<String, TrackEndpoint>,
}

impl TrackNodeCache {
    pub fn new(obj_id: String, track_node_type: String, ports: HashMap<String, TrackEndpoint>) -> Self {
        Self {
            obj_id,
            track_node_type,
            ports,
        }
    }
}

impl From<TrackNode> for TrackNodeCache {
    fn from(track_node: TrackNode) -> Self {
        Self::new(
            track_node.id.0,
            track_node.track_node_type.0,
            track_node.ports.into_iter().map(|(k, v)| (k.0, v)).collect(),
        )
    }
}

impl OSRDTyped for TrackNodeCache {
    fn get_type() -> ObjectType {
        ObjectType::TrackNode
    }
}

impl OSRDIdentified for TrackNodeCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for TrackNodeCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.ports.iter().map(|port| &*port.1.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::TrackNode(self.clone())
    }
}
