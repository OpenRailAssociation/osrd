use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::Identifier;

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Deserialize, ToSchema, Hash)]
pub struct TrackOffset {
    /// Track section identifier
    #[schema(inline)]
    pub track: Identifier,
    /// Offset in mm
    pub offset: u64,
}

impl TrackOffset {
    /// Create a new track location.
    pub fn new<T: AsRef<str>>(track: T, offset: u64) -> Self {
        Self {
            track: track.as_ref().into(),
            offset,
        }
    }
}
