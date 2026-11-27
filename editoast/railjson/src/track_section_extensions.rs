use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::TrackSectionSncfExtension;
use crate::TrackSectionSourceExtension;

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TrackSectionExtensions {
    pub sncf: Option<TrackSectionSncfExtension>,
    #[schema(inline)]
    pub source: Option<TrackSectionSourceExtension>,
}
