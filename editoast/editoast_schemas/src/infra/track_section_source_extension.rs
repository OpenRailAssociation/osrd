use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::NonBlankString;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionSourceExtension {
    #[schema(inline)]
    pub name: NonBlankString,
    #[schema(inline)]
    pub id: NonBlankString,
}
