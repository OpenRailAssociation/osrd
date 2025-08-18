use diesel::sql_types::Double;
use diesel::sql_types::Text;
use educe::Educe;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDTyped;
use schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::BufferStop;

#[derive(QueryableByName, Debug, Clone, Educe, Deserialize, Serialize)]
#[educe(Hash, PartialEq)]
pub struct BufferStopCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    #[diesel(sql_type = Double)]
    pub position: f64,
}

impl OSRDTyped for BufferStopCache {
    fn get_type() -> ObjectType {
        ObjectType::BufferStop
    }
}

impl OSRDIdentified for BufferStopCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for BufferStopCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.track]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::BufferStop(self.clone())
    }
}

impl BufferStopCache {
    pub fn new(obj_id: String, track: String, position: f64) -> Self {
        Self {
            obj_id,
            track,
            position,
        }
    }
}

impl From<BufferStop> for BufferStopCache {
    fn from(stop: BufferStop) -> Self {
        Self::new(stop.id.0, stop.track.0, stop.position)
    }
}
