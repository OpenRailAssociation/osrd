use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::NonBlankString;

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TrackSectionSourceExtension {
    #[schema(inline)]
    pub name: NonBlankString,
    #[schema(inline)]
    pub id: NonBlankString,
}
