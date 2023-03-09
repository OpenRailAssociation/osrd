use super::ApplicableDirections;
use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;
use diesel::sql_types::{Double, Text};

use serde::{Deserialize, Serialize};

use editoast_derive::InfraModel;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_detectormodel")]
#[derivative(Default)]
pub struct Detector {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
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

#[cfg(test)]
mod test {

    use super::Detector;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| Detector::default())
                .collect::<Vec<Detector>>();

            assert!(Detector::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
