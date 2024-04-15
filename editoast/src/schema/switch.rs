use std::collections::HashMap;

use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

use super::OSRDIdentified;
use super::ObjectType;
use editoast_common::Identifier;
use editoast_common::NonBlankString;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::OSRDTyped;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Switch {
    pub id: Identifier,
    pub switch_type: Identifier,
    pub group_change_delay: f64,
    pub ports: HashMap<Identifier, TrackEndpoint>,
    #[serde(default)]
    pub extensions: SwitchExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SwitchExtensions {
    sncf: Option<SwitchSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SwitchSncfExtension {
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
