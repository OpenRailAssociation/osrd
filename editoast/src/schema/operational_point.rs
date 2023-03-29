use super::OSRDIdentified;

use super::utils::Identifier;
use super::utils::NonBlankString;
use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_operationalpointmodel")]
#[derivative(Default)]
pub struct OperationalPoint {
    pub id: Identifier,
    pub parts: Vec<OperationalPointPart>,
    #[serde(default)]
    pub extensions: OperationalPointExtensions,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default, PartialEq)]
pub struct OperationalPointPart {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointExtensions {
    pub sncf: Option<OperationalPointSncfExtension>,
    pub identifier: Option<OperationalPointIdentifierExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointSncfExtension {
    pub ci: i64,
    pub ch: String,
    pub ch_short_label: NonBlankString,
    pub ch_long_label: NonBlankString,
    pub trigram: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointIdentifierExtension {
    name: NonBlankString,
    uic: i64,
}

impl OSRDTyped for OperationalPoint {
    fn get_type() -> ObjectType {
        ObjectType::OperationalPoint
    }
}

impl OSRDIdentified for OperationalPoint {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct OperationalPointCache {
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub parts: Vec<OperationalPointPart>,
}

impl OperationalPointCache {
    pub fn new(obj_id: String, parts: Vec<OperationalPointPart>) -> Self {
        Self { obj_id, parts }
    }
}

impl From<OperationalPoint> for OperationalPointCache {
    fn from(op: OperationalPoint) -> Self {
        Self::new(op.id.0, op.parts)
    }
}

impl OSRDTyped for OperationalPointCache {
    fn get_type() -> ObjectType {
        ObjectType::OperationalPoint
    }
}

impl OSRDIdentified for OperationalPointCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for OperationalPointCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.parts.iter().map(|tr| &*tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::OperationalPoint(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::OperationalPoint;
    use super::OperationalPointExtensions;
    use crate::models::infra::tests::test_infra_transaction;
    use actix_web::test as actix_test;
    use serde_json::from_str;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| OperationalPoint::default())
                .collect::<Vec<OperationalPoint>>();

            assert!(OperationalPoint::persist_batch(&data, infra.id.unwrap(), conn).is_ok());
        })
        .await;
    }

    #[test]
    fn test_op_extensions_deserialization() {
        from_str::<OperationalPointExtensions>(r#"{}"#).unwrap();
    }
}
