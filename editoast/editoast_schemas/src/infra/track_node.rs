use std::collections::HashMap;

use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::TrackEndpoint;
use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    TrackNode,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackNode {
    #[schema(inline)]
    pub id: Identifier,
    #[schema(inline)]
    pub track_node_type: Identifier,
    pub group_change_delay: f64,
    pub ports: HashMap<Identifier, TrackEndpoint>,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: TrackNodeExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TrackNodeExtensions {
    #[schema(inline)]
    sncf: Option<TrackNodeSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TrackNodeSncfExtension {
    #[schema(inline)]
    pub label: NonBlankString,
}

impl OSRDTyped for TrackNode {
    fn get_type() -> ObjectType {
        ObjectType::TrackNode
    }
}

impl OSRDIdentified for TrackNode {
    fn get_id(&self) -> &String {
        &self.id
    }
}
