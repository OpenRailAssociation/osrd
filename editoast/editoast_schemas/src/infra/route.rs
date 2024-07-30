use std::collections::HashMap;

use crate::primitives::Identifier;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use super::DirectionalTrackRange;
use super::Waypoint;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    Route,
    RoutePath,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[schema(inline)]
    pub id: Identifier,
    pub entry_point: Waypoint,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub entry_point_direction: Direction,
    pub exit_point: Waypoint,
    #[schema(inline)]
    pub release_detectors: Vec<Identifier>,
    #[schema(inline)]
    pub track_nodes_directions: HashMap<Identifier, Identifier>,
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
    // ToSchema isn’t derived correctly with tuples (inline doesn’t work)
    // so we need to specify the value_type
    #[schema(inline, value_type = Vec<(String, String)>)]
    pub track_nodes_directions: Vec<(Identifier, Identifier)>,
}
