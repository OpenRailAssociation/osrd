use derivative::Derivative;
use editoast_common::NonBlankString;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionSourceExtension {
    pub name: NonBlankString,
    pub id: NonBlankString,
}
