use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    BufferStop,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct BufferStop {
    #[schema(inline)]
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    #[serde(default)]
    #[schema(inline)]
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

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct BufferStopExtension {
    #[schema(inline)]
    pub sncf: Option<BufferStopSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct BufferStopSncfExtension {
    pub kp: String,
}
