use derivative::Derivative;
use diesel::sql_types::Double;
use diesel::sql_types::Text;
use serde::Deserialize;
use serde::Serialize;

use super::OSRDIdentified;
use super::ObjectType;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_common::Identifier;
use editoast_schemas::primitives::OSRDTyped;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Detector {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    #[serde(default)]
    pub extensions: DetectorExtension,
}

impl OSRDTyped for Detector {
    fn get_type() -> ObjectType {
        ObjectType::Detector
    }
}

impl OSRDIdentified for Detector {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct DetectorCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
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

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DetectorExtension {
    pub sncf: DetectorSncfExtension,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DetectorSncfExtension {
    pub kp: String,
}
