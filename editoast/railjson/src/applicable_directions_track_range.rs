use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::ApplicableDirections;
use crate::primitives::Identifier;

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct ApplicableDirectionsTrackRange {
    #[educe(Default = "InvalidRef".into())]
    #[schema(inline)]
    pub track: Identifier,
    pub begin: f64,
    #[educe(Default = 100.)]
    pub end: f64,
    pub applicable_directions: ApplicableDirections,
}

impl ApplicableDirectionsTrackRange {
    pub fn new<T: AsRef<str>>(
        track: T,
        begin: f64,
        end: f64,
        applicable_directions: ApplicableDirections,
    ) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
            applicable_directions,
        }
    }
}
