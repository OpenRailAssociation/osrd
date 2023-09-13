use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::schemas;

use derivative::Derivative;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

schemas! {
    SwitchType,
    SwitchPortConnection,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, InfraModel, ToSchema)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::infra_object_switch_type")]
#[derivative(Default)]
#[schema(example = json!(
    {
        "id": "Point",
        "ports": ["LEFT", "RIGHT", "BASE"],
        "groups":
        {
            "LEFT": { "src": "BASE", "dst": "LEFT" },
            "RIGHT": { "src": "BASE", "dst": "RIGHT" }
        }
    }
))]
pub struct SwitchType {
    #[schema(value_type = String)]
    pub id: Identifier,
    #[schema(value_type = Vec<String>)]
    pub ports: Vec<Identifier>,
    #[schema(additional_properties = false, value_type = HashMap<String, Vec<SwitchPortConnection>>)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchPortConnection {
    #[schema(value_type = String)]
    pub src: Identifier,
    #[schema(value_type = String)]
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
    use crate::models::infra::tests::test_infra_transaction;
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            async move {
                let data = (0..10)
                    .map(|_| SwitchType::default())
                    .collect::<Vec<SwitchType>>();

                assert!(SwitchType::persist_batch(&data, infra.id.unwrap(), conn)
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await;
    }
}
