use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_common::units;
use editoast_common::units::quantities::Length;

use crate::primitives::Identifier;

editoast_common::schemas! {
    TrackOffset,
}

#[editoast_derive::annotate_units]
#[derive(Debug, PartialEq, Clone, Serialize, Deserialize, ToSchema, Educe)]
#[educe(Hash, Eq)]
pub struct TrackOffset {
    /// Track section identifier
    #[schema(inline)]
    pub track: Identifier,
    #[serde(with = "units::millimeter")]
    #[educe(Hash(method(units::millimeter::hash)))]
    pub offset: Length,
}

impl TrackOffset {
    /// Create a new track location.
    pub fn new<T: AsRef<str>>(track: T, offset: Length) -> Self {
        Self {
            track: track.as_ref().into(),
            offset,
        }
    }
}
