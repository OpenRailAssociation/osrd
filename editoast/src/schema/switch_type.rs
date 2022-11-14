use super::generate_id;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::tables::osrd_infra_switchtypemodel::dsl::*;
use derivative::Derivative;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchType {
    #[derivative(Default(value = r#"generate_id("switchtype")"#))]
    pub id: String,
    pub ports: Vec<String>,
    pub groups: HashMap<String, Vec<SwitchPortConnection>>,
}

impl SwitchType {
    pub fn persist_batch(
        values: &[Self],
        infrastructure_id: i32,
        conn: &PgConnection,
    ) -> Result<(), Box<dyn ApiError>> {
        let datas = values
            .iter()
            .map(|value| {
                (
                    obj_id.eq(value.get_id().clone()),
                    data.eq(serde_json::to_value(value).unwrap()),
                    infra_id.eq(infrastructure_id),
                )
            })
            .collect::<Vec<_>>();

        for data_chunk in datas.chunks(65534) {
            diesel::insert_into(osrd_infra_switchtypemodel)
                .values(data_chunk)
                .execute(conn)?;
        }

        Ok(())
    }
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
    pub src: String,
    pub dst: String,
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
