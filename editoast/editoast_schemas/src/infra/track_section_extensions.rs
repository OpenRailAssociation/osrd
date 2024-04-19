use crate::infra::TrackSectionSncfExtension;
use crate::infra::TrackSectionSourceExtension;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TrackSectionExtensions {
    pub sncf: Option<TrackSectionSncfExtension>,
    pub source: Option<TrackSectionSourceExtension>,
}
