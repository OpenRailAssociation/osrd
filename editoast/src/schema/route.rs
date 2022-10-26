use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use super::generate_id;
use super::DirectionalTrackRange;
use super::OSRDObject;
use super::ObjectType;
use super::Waypoint;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: Waypoint,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<String>,
    pub path: Vec<DirectionalTrackRange>,
}

impl OSRDObject for Route {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::Route
    }
}

impl Cache for Route {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.path.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Route(self.clone())
    }
}
