use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use derivative::Derivative;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_switchtypemodel")]
#[derivative(Default)]
pub struct SwitchType {
    pub id: Identifier,
    pub ports: Vec<Identifier>,
    pub groups: HashMap<Identifier, Vec<SwitchPortConnection>>,
}

impl OSRDTyped for SwitchType {
    fn get_type() -> ObjectType {
        ObjectType::SwitchType
    }
}

impl OSRDIdentified for SwitchType {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchPortConnection {
    pub src: Identifier,
    pub dst: Identifier,
}

impl Cache for SwitchType {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SwitchType(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::SwitchType;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| SwitchType::default())
                .collect::<Vec<SwitchType>>();

            assert!(SwitchType::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
