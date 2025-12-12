use educe::Educe;
use schemas::primitives::Identifier;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDTyped;
use schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::LevelCrossing;
use schemas::infra::LevelCrossingPart;

#[derive(Debug, Clone, Educe, Deserialize, Serialize)]
#[educe(Hash, PartialEq)]
pub struct LevelCrossingCache {
    pub obj_id: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub parts: Vec<LevelCrossingPartCache>,
}

impl LevelCrossingCache {
    pub fn new(obj_id: String, parts: Vec<LevelCrossingPartCache>) -> Self {
        Self { obj_id, parts }
    }
}

impl From<LevelCrossing> for LevelCrossingCache {
    fn from(lc: LevelCrossing) -> Self {
        let parts = lc.parts.into_iter().map(|p| p.into()).collect();
        Self::new(lc.id.0, parts)
    }
}

impl OSRDTyped for LevelCrossingCache {
    fn get_type() -> ObjectType {
        ObjectType::LevelCrossing
    }
}

impl OSRDIdentified for LevelCrossingCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for LevelCrossingCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.parts.iter().map(|tr| &*tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::LevelCrossing(self.clone())
    }
}

#[derive(Debug, Educe, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[educe(Default, PartialEq)]
pub struct LevelCrossingPartCache {
    #[educe(Default = "InvalidRef".into())]
    pub track: Identifier,
    pub position: f64,
}

impl From<LevelCrossingPart> for LevelCrossingPartCache {
    fn from(lcp: LevelCrossingPart) -> Self {
        Self {
            track: lcp.track,
            position: lcp.position,
        }
    }
}
