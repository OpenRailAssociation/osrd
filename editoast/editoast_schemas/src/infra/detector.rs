use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    Detector,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Detector {
    #[schema(inline)]
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    #[serde(default)]
    #[schema(inline)]
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

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct DetectorExtension {
    #[schema(inline)]
    pub sncf: DetectorSncfExtension,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct DetectorSncfExtension {
    pub kp: String,
}
