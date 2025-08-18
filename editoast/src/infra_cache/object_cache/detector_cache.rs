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
use schemas::infra::Detector;

#[derive(QueryableByName, Debug, Clone, Educe, Deserialize, Serialize)]
#[educe(Hash, PartialEq)]
pub struct DetectorCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    #[diesel(sql_type = Double)]
    pub position: f64,
}

impl DetectorCache {
    pub fn new(obj_id: String, track: String, position: f64) -> Self {
        Self {
            obj_id,
            track,
            position,
        }
    }
}

impl From<Detector> for DetectorCache {
    fn from(detector: Detector) -> Self {
        Self::new(detector.id.0, detector.track.0, detector.position)
    }
}

impl OSRDTyped for DetectorCache {
    fn get_type() -> ObjectType {
        ObjectType::Detector
    }
}

impl OSRDIdentified for DetectorCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for DetectorCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.track]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Detector(self.clone())
    }
}
