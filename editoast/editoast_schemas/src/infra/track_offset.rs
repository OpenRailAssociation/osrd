use editoast_common::Identifier;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrackOffset,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Hash)]
pub struct TrackOffset {
    #[schema(inline)]
    pub track: Identifier,
    pub offset: u64,
}
