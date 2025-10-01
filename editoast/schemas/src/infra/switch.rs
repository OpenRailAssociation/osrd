use std::collections::HashMap;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::TrackEndpoint;
use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct Switch {
    #[schema(inline)]
    pub id: Identifier,
    #[schema(inline)]
    pub switch_type: Identifier,
    pub group_change_delay: f64,
    pub ports: HashMap<Identifier, TrackEndpoint>,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: SwitchExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SwitchExtensions {
    #[schema(inline)]
    sncf: Option<SwitchSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SwitchSncfExtension {
    #[schema(inline)]
    pub label: NonBlankString,
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
