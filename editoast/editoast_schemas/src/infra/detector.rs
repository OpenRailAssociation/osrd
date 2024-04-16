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
pub struct Detector {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    #[serde(default)]
    pub extensions: DetectorExtension,
}

impl OSRDTyped for Detector {
    fn get_type() -> ObjectType {
        ObjectType::Detector
    }
}

impl OSRDIdentified for Detector {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DetectorExtension {
    pub sncf: DetectorSncfExtension,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DetectorSncfExtension {
    pub kp: String,
}
