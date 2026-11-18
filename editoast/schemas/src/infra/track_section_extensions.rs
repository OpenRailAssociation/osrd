use std::collections::BTreeMap;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::infra::TrackSectionSncfExtension;
use crate::infra::TrackSectionSourceExtension;

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
pub struct TrackSectionExtensions {
    pub sncf: Option<TrackSectionSncfExtension>,
    #[schema(inline)]
    pub source: Option<TrackSectionSourceExtension>,
    /// Line and track identification of the track section in the terms of any other infrastructure
    /// manager, keyed by its short name (`db`, `sbb`, `oebb`, …), each a `TrackSectionSncfExtension`
    #[serde(flatten)]
    #[schema(value_type = HashMap<String, serde_json::Value>)]
    pub infrastructure_managers: BTreeMap<String, TrackSectionSncfExtension>,
}

impl TrackSectionExtensions {
    /// The line and track identification of the track section, whichever infrastructure manager states it
    ///
    /// `sncf` comes first, then the other infrastructure managers by name.
    pub fn line(&self) -> Option<&TrackSectionSncfExtension> {
        self.sncf
            .as_ref()
            .or_else(|| self.infrastructure_managers.values().next())
    }
}
