use super::generate_id;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;

use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Model)]
#[serde(deny_unknown_fields)]
#[model(table = "crate::tables::osrd_infra_operationalpointmodel")]
#[derivative(Default)]
pub struct OperationalPoint {
    #[derivative(Default(value = r#"generate_id("operational_point")"#))]
    pub id: String,
    pub parts: Vec<OperationalPointPart>,
    #[serde(default)]
    pub extensions: OperationalPointExtensions,
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
    pub ch_short_label: String,
    pub ch_long_label: String,
    pub trigram: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointIdentifierExtension {
    name: String,
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default, PartialEq)]
pub struct OperationalPointPart {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub position: f64,
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
        Self::new(op.id, op.parts)
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
        self.parts.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::OperationalPoint(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::OperationalPoint;
    use super::OperationalPointExtensions;
    use crate::infra::tests::test_infra_transaction;
    use serde_json::from_str;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| OperationalPoint::default())
                .collect::<Vec<OperationalPoint>>();

            assert!(OperationalPoint::persist_batch(&data, infra.id, conn).is_ok());
        });
    }

    #[test]
    fn test_op_extensions_deserialization() {
        from_str::<OperationalPointExtensions>(r#"{}"#).unwrap();
    }
}
