use super::generate_id;
use super::DirectionalTrackRange;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use super::Waypoint;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use derivative::Derivative;

use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Model)]
#[serde(deny_unknown_fields)]
#[model(table = "crate::tables::osrd_infra_routemodel")]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: Waypoint,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<String>,
    pub path: Vec<DirectionalTrackRange>,
}

impl OSRDTyped for Route {
    fn get_type() -> ObjectType {
        ObjectType::Route
    }
}

impl OSRDIdentified for Route {
    fn get_id(&self) -> &String {
        &self.id
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

#[cfg(test)]
mod test {

    use super::Route;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10).map(|_| Route::default()).collect::<Vec<Route>>();

            assert!(Route::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
