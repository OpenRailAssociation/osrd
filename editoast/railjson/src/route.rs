use std::collections::HashMap;

use crate::primitives::Identifier;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use super::DirectionalTrackRange;
use super::Waypoint;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct Route {
    #[schema(inline)]
    pub id: Identifier,
    pub entry_point: Waypoint,
    #[educe(Default = Direction::StartToStop)]
    pub entry_point_direction: Direction,
    pub exit_point: Waypoint,
    #[schema(inline)]
    pub release_detectors: Vec<Identifier>,
    #[schema(inline)]
    pub switches_directions: HashMap<Identifier, Identifier>,
}

impl OSRDTyped for Route {
    fn get_type() -> ObjectType {
        ObjectType::Route
    }
}

impl OSRDIdentified for Route {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
pub struct RoutePath {
    pub track_ranges: Vec<DirectionalTrackRange>,
    #[schema(inline)]
    pub switches_directions: Vec<SwitchDirection>,
}

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
pub struct SwitchDirection {
    #[schema(inline)]
    pub switch_id: Identifier,
    #[schema(inline)]
    pub group_id: Identifier,
}
