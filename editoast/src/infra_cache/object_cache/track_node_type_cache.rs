use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::TrackNodeType;

impl Cache for TrackNodeType {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::TrackNodeType(self.clone())
    }
}
