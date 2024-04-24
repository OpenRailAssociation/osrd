use crate::primitives::NonBlankString;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::ApplicableDirectionsTrackRange;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    Electrification,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Electrification {
    #[schema(inline)]
    pub id: Identifier,
    #[schema(inline)]
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
