use editoast_common::Identifier;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrackLocation,
}

/// A track location is a track section and an offset
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct TrackLocation {
    /// The track section UUID
    #[schema(inline)]
    pub track_section: Identifier,
    /// The offset on the track section in meters
    pub offset: f64,
}
