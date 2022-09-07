use crate::layer::Layer;

use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct BufferStop {
    #[derivative(Default(value = r#"generate_id("buffer_stop")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
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
