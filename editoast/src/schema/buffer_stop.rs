use super::generate_id;
use super::ApplicableDirections;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use crate::infra_cache::{Cache, ObjectCache};
use derivative::Derivative;
use diesel::sql_types::{Double, Text};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Model)]
#[serde(deny_unknown_fields)]
#[model(table = "crate::tables::osrd_infra_bufferstopmodel")]
#[derivative(Default)]
pub struct BufferStop {
    #[derivative(Default(value = r#"generate_id("buffer_stop")"#))]
    pub id: String,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
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
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
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
        Self::new(stop.id, stop.track, stop.position)
    }
}

#[cfg(test)]
mod test {

    use super::BufferStop;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| BufferStop::default())
                .collect::<Vec<BufferStop>>();

            assert!(BufferStop::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
