use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::SwitchType;

impl Cache for SwitchType {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SwitchType(self.clone())
    }
}
