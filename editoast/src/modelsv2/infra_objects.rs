use crate::schema::TrackSection;
use crate::tables::*;
use editoast_derive::ModelV2;
use serde::{Deserialize, Serialize};

macro_rules! infra_model {
    ($name:ident, $table:ident, $data:ident) => {
        #[derive(Debug, Clone, Default, Serialize, Deserialize, ModelV2)]
        #[model(table = $table)]
        #[model(preferred = (infra_id, obj_id))]
        pub struct $name {
            pub id: i64,
            pub obj_id: String,
            #[model(json)]
            pub data: $data,
            pub infra_id: i64,
        }
    };
}

infra_model!(TrackSectionModel, infra_object_track_section, TrackSection);
