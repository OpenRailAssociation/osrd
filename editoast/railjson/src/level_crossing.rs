use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::TrackOffset;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct LevelCrossing {
    #[schema(inline)]
    pub id: Identifier,
    pub name: String,
    /// Short zone length in mm
    pub short_zone_length: u64,
    pub parts: Vec<LevelCrossingPart>,
}

#[derive(Debug, Educe, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct LevelCrossingPart {
    #[educe(Default = "InvalidRef".into())]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    /// Offset in mm of the upstream pedal from the main position (upstream refers to the START_TO_STOP direction of the track)
    pub pedal_upstream: u64,
    /// Offset in mm of the downstream pedal from the main position (downstream refers to the START_TO_STOP direction of the track)
    pub pedal_downstream: u64,
}

impl OSRDTyped for LevelCrossing {
    fn get_type() -> ObjectType {
        ObjectType::LevelCrossing
    }
}

impl OSRDIdentified for LevelCrossing {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl LevelCrossing {
    pub fn track_offset(&self) -> Vec<TrackOffset> {
        self.parts
            .clone()
            .into_iter()
            .map(|lcp| TrackOffset {
                track: lcp.track,
                offset: (lcp.position * 1000.0).round() as u64,
            })
            .collect()
    }
}
