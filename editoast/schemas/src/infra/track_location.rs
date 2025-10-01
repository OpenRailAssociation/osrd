use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::Identifier;

/// A track location is a track section and an offset
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct TrackLocation {
    /// The track section UUID
    #[schema(inline)]
    pub track_section: Identifier,
    /// The offset on the track section in meters
    pub offset: f64,
}
