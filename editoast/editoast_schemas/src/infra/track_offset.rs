use crate::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrackOffset,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Hash)]
pub struct TrackOffset {
    /// Track section identifier
    #[schema(inline)]
    pub track: Identifier,
    /// Offset in mm
    pub offset: u64,
}
