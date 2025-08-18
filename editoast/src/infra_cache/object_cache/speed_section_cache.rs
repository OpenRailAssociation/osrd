use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::SpeedSection;

impl Cache for SpeedSection {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        let mut res: Vec<_> = self.track_ranges.iter().map(|tr| &*tr.track).collect();
        if let Some(psl) = &self.extensions.psl_sncf {
            res.extend(psl.announcement().iter().map(|sign| &*sign.track));
            res.extend(psl.r().iter().map(|sign| &*sign.track));
            res.push(&*psl.z().track);
        }
        res
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SpeedSection(self.clone())
    }
}
