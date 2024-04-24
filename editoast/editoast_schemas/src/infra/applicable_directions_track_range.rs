use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::ApplicableDirections;
use crate::primitives::Identifier;

editoast_common::schemas! {
    ApplicableDirectionsTrackRange,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct ApplicableDirectionsTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
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
