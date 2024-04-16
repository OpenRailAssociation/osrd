use derivative::Derivative;
use editoast_common::Identifier;
use serde::Deserialize;
use serde::Serialize;

use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

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
