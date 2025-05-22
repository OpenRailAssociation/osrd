use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::NonBlankString;

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct TrackSectionSncfExtension {
    pub line_code: i32,
    #[educe(Default = "line_test".into())]
    #[schema(inline)]
    pub line_name: NonBlankString,
    pub track_number: i32,
    #[educe(Default = "track_test".into())]
    #[schema(inline)]
    pub track_name: NonBlankString,
}
