use crate::primitives::NonBlankString;
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
pub struct OperationalPoint {
    #[schema(inline)]
    pub id: Identifier,
    pub parts: Vec<OperationalPointPart>,
    #[serde(default)]
    pub weight: Option<u8>,
    #[schema(inline)]
    pub name: NonBlankString,
    pub uic: Option<u32>,
    /// Primary Location Code : https://rne.eu/it/products/ccs/crd/
    #[schema(inline)]
    pub plc: Option<NonBlankString>,
    #[schema(inline)]
    pub country_code: NonBlankString,
    #[schema(inline)]
    pub main_code: NonBlankString,
    #[schema(inline)]
    pub secondary_code: Option<NonBlankString>,
    pub is_passenger_station: bool,
    #[schema(inline)]
    pub secondary_name: Option<NonBlankString>,
}

#[derive(Debug, Educe, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct OperationalPointPart {
    #[educe(Default = "InvalidRef".into())]
    #[schema(inline)]
    pub track: Identifier,
    /// Offset on the track section, in m
    pub position: f64,
    pub local_track_name: NonBlankString,
    #[serde(default)]
    pub extensions: OperationalPointPartExtension,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointPartExtension {
    pub sncf: Option<OperationalPointPartSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointPartSncfExtension {
    pub kp: String,
}

impl OSRDTyped for OperationalPoint {
    fn get_type() -> ObjectType {
        ObjectType::OperationalPoint
    }
}

impl OSRDIdentified for OperationalPoint {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl OperationalPoint {
    pub fn track_offsets(&self) -> Vec<TrackOffset> {
        self.track_offsets_by_local_track_name(None)
    }

    pub fn track_offsets_by_local_track_name(
        &self,
        local_track_name: Option<&NonBlankString>,
    ) -> Vec<TrackOffset> {
        self.parts
            .iter()
            .filter(|part| {
                local_track_name
                    .is_none_or(|local_track_name| *local_track_name == part.local_track_name)
            })
            .map(|part| TrackOffset {
                track: part.track.clone(),
                offset: (part.position * 1000.0).round() as u64,
            })
            .collect()
    }
}
