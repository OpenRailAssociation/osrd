use crate::primitives::Identifier;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use uom::si::length::meter;
use utoipa::ToSchema;

use editoast_common::units;
use editoast_common::units::quantities::Length;

editoast_common::schemas! {
    TrackRange,
}

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct TrackRange {
    #[schema(value_type=String, example="01234567-89ab-cdef-0123-456789abcdef")]
    #[educe(Default = "InvalidRef".into())]
    pub track: Identifier,
    #[serde(with = "units::meter")]
    pub begin: Length,
    #[educe(Default = Length::new::<meter>(100.))]
    #[serde(with = "units::meter")]
    pub end: Length,
}

impl TrackRange {
    pub fn new<T: AsRef<str>>(track: T, begin: Length, end: Length) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
        }
    }
}
