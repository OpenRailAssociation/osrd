use derivative::Derivative;
use editoast_common::NonBlankString;
use serde::Deserialize;
use serde::Serialize;

use super::ApplicableDirectionsTrackRange;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Electrification {
    pub id: Identifier,
    pub voltage: NonBlankString,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

impl OSRDTyped for Electrification {
    fn get_type() -> ObjectType {
        ObjectType::Electrification
    }
}

impl OSRDIdentified for Electrification {
    fn get_id(&self) -> &String {
        &self.id
    }
}
