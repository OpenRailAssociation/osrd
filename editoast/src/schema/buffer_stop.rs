use super::{OSRDIdentified, OSRDTyped, ObjectType};

use super::utils::Identifier;
use crate::infra_cache::{Cache, ObjectCache};
use derivative::Derivative;
use diesel::sql_types::{Double, Text};
use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_bufferstopmodel")]
#[derivative(Default)]
pub struct BufferStop {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
}

impl OSRDTyped for BufferStop {
    fn get_type() -> ObjectType {
        ObjectType::BufferStop
    }
}

impl OSRDIdentified for BufferStop {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct BufferStopCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
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

#[cfg(test)]
mod test {

    use super::BufferStop;
    use crate::models::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| BufferStop::default())
                .collect::<Vec<BufferStop>>();

            assert!(BufferStop::persist_batch(&data, infra.id, conn).is_ok());
        });
    }

    #[test]
    fn test_persist_large() {
        test_infra_transaction(|conn, infra| {
            let data = (0..(2_usize.pow(16) * 2))
                .map(|_| BufferStop::default())
                .collect::<Vec<BufferStop>>();

            assert!(BufferStop::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
