use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectType;
use derivative::Derivative;
use diesel::sql_types::{Double, Text};
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Detector {
    #[derivative(Default(value = r#"generate_id("detector")"#))]
    pub id: String,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
}

impl OSRDObject for Detector {
    fn get_type(&self) -> ObjectType {
        ObjectType::Detector
    }

    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct DetectorCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
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
    fn from(det: Detector) -> Self {
        Self::new(det.id, det.track, det.position)
    }
}

impl OSRDObject for DetectorCache {
    fn get_type(&self) -> ObjectType {
        ObjectType::Detector
    }

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
