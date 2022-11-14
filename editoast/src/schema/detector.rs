use super::generate_id;
use super::ApplicableDirections;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;
use diesel::sql_types::{Double, Text};
use diesel::PgConnection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
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

impl Detector {
    pub fn persist_batch(
        values: &[Self],
        infrastructure_id: i32,
        conn: &PgConnection,
    ) -> Result<(), Box<dyn ApiError>> {
        use crate::tables::osrd_infra_detectormodel::dsl::*;
        let datas = values
            .iter()
            .map(|value| {
                (
                    obj_id.eq(value.get_id().clone()),
                    data.eq(serde_json::to_value(value).unwrap()),
                    infra_id.eq(infrastructure_id),
                )
            })
            .collect::<Vec<_>>();

        for data_chunk in datas.chunks(65534) {
            diesel::insert_into(osrd_infra_detectormodel)
                .values(data_chunk)
                .execute(conn)?;
        }

        Ok(())
    }
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
