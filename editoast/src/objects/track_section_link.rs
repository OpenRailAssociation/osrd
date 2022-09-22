use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectType;
use super::TrackEndpoint;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionLink {
    #[derivative(Default(value = r#"generate_id("track_section_link")"#))]
    pub id: String,
    pub src: TrackEndpoint,
    pub dst: TrackEndpoint,
    pub navigability: ApplicableDirections,
}

impl OSRDObject for TrackSectionLink {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::TrackSectionLink
    }
}

impl Layer for TrackSectionLink {
    fn get_table_name() -> &'static str {
        "osrd_infra_tracksectionlinklayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_track_section_link_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_update_track_section_link_layer.sql")
    }

    fn layer_name() -> &'static str {
        "track_section_links"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::TrackSectionLink
    }
}

impl Cache for TrackSectionLink {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.src.track.obj_id, &self.dst.track.obj_id]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::TrackSectionLink(self.clone())
    }
}
