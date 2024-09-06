use crate::primitives::Identifier;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrackRange,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackRange {
    #[schema(value_type=String, example="01234567-89ab-cdef-0123-456789abcdef")]
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
}

impl TrackRange {
    pub fn new<T: AsRef<str>>(track: T, begin: f64, end: f64) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
        }
    }
}
