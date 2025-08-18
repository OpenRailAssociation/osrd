use educe::Educe;
use schemas::primitives::Identifier;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDTyped;
use schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::OperationalPoint;
use schemas::infra::OperationalPointPart;

#[derive(Debug, Clone, Educe, Deserialize, Serialize)]
#[educe(Hash, PartialEq)]
pub struct OperationalPointCache {
    pub obj_id: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub parts: Vec<OperationalPointPartCache>,
}

impl OperationalPointCache {
    pub fn new(obj_id: String, parts: Vec<OperationalPointPartCache>) -> Self {
        Self { obj_id, parts }
    }
}

impl From<OperationalPoint> for OperationalPointCache {
    fn from(op: OperationalPoint) -> Self {
        let parts = op.parts.into_iter().map(|p| p.into()).collect();
        Self::new(op.id.0, parts)
    }
}

impl OSRDTyped for OperationalPointCache {
    fn get_type() -> ObjectType {
        ObjectType::OperationalPoint
    }
}

impl OSRDIdentified for OperationalPointCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for OperationalPointCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.parts.iter().map(|tr| &*tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::OperationalPoint(self.clone())
    }
}

#[derive(Debug, Educe, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[educe(Default, PartialEq)]
pub struct OperationalPointPartCache {
    #[educe(Default = "InvalidRef".into())]
    pub track: Identifier,
    pub position: f64,
}

impl From<OperationalPointPart> for OperationalPointPartCache {
    fn from(op: OperationalPointPart) -> Self {
        Self {
            track: op.track,
            position: op.position,
        }
    }
}
