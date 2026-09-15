use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::infra::TrackSectionSncfExtension;
use crate::infra::TrackSectionSourceExtension;

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TrackSectionExtensions {
    pub sncf: Option<TrackSectionSncfExtension>,
    #[schema(inline)]
    pub source: Option<TrackSectionSourceExtension>,
    /// Free-form, infrastructure-manager-specific data. OSRD does not interpret it: it is stored and returned as-is, so that RailJSON carrying data OSRD has no schema for can be imported without loss.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub db: Option<serde_json::Value>,
}
