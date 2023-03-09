use super::utils::Identifier;
use super::utils::NonBlankString;
use super::ApplicableDirectionsTrackRange;
use super::OSRDIdentified;
use editoast_derive::InfraModel;

use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;

use serde::{Deserialize, Serialize};
#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_catenarymodel")]
#[derivative(Default)]
pub struct Catenary {
    pub id: Identifier,
    pub voltage: NonBlankString,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

impl OSRDTyped for Catenary {
    fn get_type() -> ObjectType {
        ObjectType::Catenary
    }
}

impl OSRDIdentified for Catenary {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Cache for Catenary {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.track_ranges.iter().map(|tr| &*tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Catenary(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::Catenary;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| Catenary::default())
                .collect::<Vec<Catenary>>();

            assert!(Catenary::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
