use std::collections::HashMap;

use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

use super::OSRDIdentified;
use super::ObjectType;
use editoast_common::Identifier;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::DirectionalTrackRange;
use editoast_schemas::infra::Waypoint;
use editoast_schemas::primitives::OSRDTyped;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    pub id: Identifier,
    pub entry_point: Waypoint,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub entry_point_direction: Direction,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<Identifier>,
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

#[derive(Debug, Clone)]
pub struct RoutePath {
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub switches_directions: HashMap<Identifier, Identifier>,
}
