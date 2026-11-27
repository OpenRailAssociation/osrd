use crate::primitives::Identifier;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct TrackRange {
    #[schema(value_type=String, example="01234567-89ab-cdef-0123-456789abcdef")]
    #[educe(Default = "InvalidRef".into())]
    pub track: Identifier,
    pub begin: f64,
    #[educe(Default = 100.)]
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
