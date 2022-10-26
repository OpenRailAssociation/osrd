use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

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
pub struct BufferStop {
    #[derivative(Default(value = r#"generate_id("buffer_stop")"#))]
    pub id: String,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
}

impl OSRDObject for BufferStop {
    fn get_type(&self) -> ObjectType {
        ObjectType::BufferStop
    }

    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Layer for BufferStop {
    fn get_table_name() -> &'static str {
        "osrd_infra_bufferstoplayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_buffer_stop_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_update_buffer_stop_layer.sql")
    }

    fn layer_name() -> &'static str {
        "buffer_stops"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::BufferStop
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

impl OSRDObject for BufferStopCache {
    fn get_type(&self) -> ObjectType {
        ObjectType::BufferStop
    }

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
