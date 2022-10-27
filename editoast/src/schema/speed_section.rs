use std::collections::HashMap;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use super::generate_id;
use super::ApplicableDirectionsTrackRange;
use super::OSRDObject;
use super::ObjectType;
use super::Panel;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SpeedSection {
    #[derivative(Default(value = r#"generate_id("speed_section")"#))]
    pub id: String,
    #[derivative(Default(value = "Some(80.)"))]
    pub speed_limit: Option<f64>,
    pub speed_limit_by_tag: HashMap<String, f64>,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
    #[serde(default)]
    pub extensions: SpeedSectionExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SpeedSectionExtensions {
    pub lpv_sncf: Option<SpeedSectionLpvSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SpeedSectionLpvSncfExtension {
    announcement: Vec<Panel>,
    z: Panel,
    r: Vec<Panel>,
}

impl OSRDObject for SpeedSection {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::SpeedSection
    }
}

impl Cache for SpeedSection {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        let mut res: Vec<_> = self.track_ranges.iter().map(|tr| &tr.track).collect();
        if let Some(lpv) = &self.extensions.lpv_sncf {
            res.extend(lpv.announcement.iter().map(|panel| &panel.track));
            res.extend(lpv.r.iter().map(|panel| &panel.track));
            res.push(&lpv.z.track);
        }
        res
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SpeedSection(self.clone())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;

    use super::SpeedSectionExtensions;

    #[test]
    fn test_speed_section_extensions_deserialization() {
        from_str::<SpeedSectionExtensions>(r#"{}"#).unwrap();
    }
}
