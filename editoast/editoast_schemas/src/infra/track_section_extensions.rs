use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::infra::TrackSectionSncfExtension;
use crate::infra::TrackSectionSourceExtension;

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TrackSectionExtensions {
    #[schema(inline)]
    pub sncf: Option<TrackSectionSncfExtension>,
    #[schema(inline)]
    pub source: Option<TrackSectionSourceExtension>,
}
