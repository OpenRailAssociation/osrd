use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

use super::OSRDIdentified;
use super::ObjectType;
use editoast_common::Identifier;
use editoast_common::NonBlankString;
use editoast_schemas::infra::ApplicableDirectionsTrackRange;
use editoast_schemas::primitives::OSRDTyped;
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
