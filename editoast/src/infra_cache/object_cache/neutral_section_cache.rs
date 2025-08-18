use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::NeutralSection;

impl Cache for NeutralSection {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        let mut res: Vec<_> = self.track_ranges.iter().map(|tr| &*tr.track).collect();
        res.extend(self.announcement_track_ranges.iter().map(|tr| &*tr.track));
        if let Some(ext) = &self.extensions.neutral_sncf {
            res.push(&*ext.exe.track);
            res.extend(ext.announcement.iter().map(|sign| &*sign.track));
            res.extend(ext.end.iter().map(|sign| &*sign.track));
            res.extend(ext.rev.iter().map(|sign| &*sign.track));
        }
        res
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::NeutralSection(self.clone())
    }
}
