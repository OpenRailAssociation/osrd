use super::generate_id;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct OperationalPoint {
    #[derivative(Default(value = r#"generate_id("operational_point")"#))]
    pub id: String,
    pub parts: Vec<OperationalPointPart>,
    pub uic: i64,
    pub ci: i64,
    pub ch: String,
    pub ch_short_label: Option<String>,
    pub ch_long_label: Option<String>,
    pub name: String,
    pub trigram: String,
}

impl OSRDObject for OperationalPoint {
    fn get_type(&self) -> ObjectType {
        ObjectType::OperationalPoint
    }

    fn get_id(&self) -> String {
        self.id.clone()
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct OperationalPointPart {
    pub track: ObjectRef,
    pub position: f64,
}
