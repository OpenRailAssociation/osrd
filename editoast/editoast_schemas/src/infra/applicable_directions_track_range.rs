use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

use super::ApplicableDirections;
use crate::primitives::Identifier;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct ApplicableDirectionsTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
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
