use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use super::generate_id;
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
}

impl OSRDObject for TrackSectionLink {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::TrackSectionLink
    }
}

impl Cache for TrackSectionLink {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.src.track, &self.dst.track]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::TrackSectionLink(self.clone())
    }
}
