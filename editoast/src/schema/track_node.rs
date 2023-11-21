use super::OSRDIdentified;

use super::utils::Identifier;
use super::utils::NonBlankString;
use super::OSRDTyped;
use super::ObjectType;
use super::TrackEndpoint;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackNode {
    pub id: Identifier,
    pub track_node_type: Identifier,
    pub group_change_delay: f64,
    pub ports: HashMap<Identifier, TrackEndpoint>,
    #[serde(default)]
    pub extensions: TrackNodeExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TrackNodeExtensions {
    sncf: Option<TrackNodeSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TrackNodeSncfExtension {
    pub label: NonBlankString,
}

impl OSRDTyped for TrackNode {
    fn get_type() -> ObjectType {
        ObjectType::TrackNode
    }
}

impl OSRDIdentified for TrackNode {
    fn get_id(&self) -> &String {
        &self.id
    }
}

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
