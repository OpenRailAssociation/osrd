use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::Electrification;

impl Cache for Electrification {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.track_ranges.iter().map(|tr| &*tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Electrification(self.clone())
    }
}
