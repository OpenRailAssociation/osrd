use std::collections::HashMap;

use super::Direction;
use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;
use super::Waypoint;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use derivative::Derivative;

use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Model)]
#[serde(deny_unknown_fields)]
#[model(table = "crate::tables::osrd_infra_routemodel")]
#[derivative(Default)]
pub struct Route {
    pub id: Identifier,
    pub entry_point: Waypoint,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub entry_point_direction: Direction,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<Identifier>,
    pub switches_directions: HashMap<Identifier, Identifier>,
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
        // We don't have a layer linked to this object yet.
        // So we don't need to keep track of the referenced tracks.
        vec![]
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
