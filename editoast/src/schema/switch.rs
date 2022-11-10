use super::generate_id;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use super::TrackEndpoint;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Switch {
    #[derivative(Default(value = r#"generate_id("switch")"#))]
    pub id: String,
    pub switch_type: String,
    pub group_change_delay: f64,
    pub ports: HashMap<String, TrackEndpoint>,
    #[serde(default)]
    pub extensions: SwitchExtensions,
}

impl Switch {
    pub fn persist_batch(
        values: &[Self],
        infrastructure_id: i32,
        conn: &PgConnection,
    ) -> Result<(), Box<dyn ApiError>> {
        use crate::tables::osrd_infra_switchmodel::dsl::*;
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

        diesel::insert_into(osrd_infra_switchmodel)
            .values(datas)
            .execute(conn)?;

        Ok(())
    }
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SwitchExtensions {
    sncf: Option<SwitchSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SwitchSncfExtension {
    pub label: String,
}

impl OSRDTyped for Switch {
    fn get_type() -> ObjectType {
        ObjectType::Switch
    }
}

impl OSRDIdentified for Switch {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SwitchCache {
    pub obj_id: String,
    pub switch_type: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub ports: HashMap<String, TrackEndpoint>,
}

impl SwitchCache {
    pub fn new(obj_id: String, switch_type: String, ports: HashMap<String, TrackEndpoint>) -> Self {
        Self {
            obj_id,
            switch_type,
            ports,
        }
    }
}

impl From<Switch> for SwitchCache {
    fn from(switch: Switch) -> Self {
        Self::new(switch.id, switch.switch_type, switch.ports)
    }
}

impl OSRDTyped for SwitchCache {
    fn get_type() -> ObjectType {
        ObjectType::Switch
    }
}

impl OSRDIdentified for SwitchCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for SwitchCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.ports.iter().map(|port| &port.1.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Switch(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::Switch;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10).map(|_| Switch::default()).collect::<Vec<Switch>>();

            assert!(Switch::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
