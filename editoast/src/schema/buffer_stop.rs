use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

use super::OSRDIdentified;
use super::ObjectType;
use editoast_common::Identifier;
use editoast_schemas::primitives::OSRDTyped;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct BufferStop {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    #[serde(default)]
    pub extensions: BufferStopExtension,
}

impl OSRDTyped for BufferStop {
    fn get_type() -> ObjectType {
        ObjectType::BufferStop
    }
}

impl OSRDIdentified for BufferStop {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct BufferStopExtension {
    pub sncf: Option<BufferStopSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct BufferStopSncfExtension {
    pub kp: String,
}
