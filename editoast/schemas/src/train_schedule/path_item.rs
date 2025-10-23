use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::infra::TrackOffset;

/// A location on the path of a train
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PathItem {
    /// The unique identifier of the path item.
    /// This is used to reference path items in the train schedule.
    #[schema(inline)]
    pub id: NonBlankString,
    pub location: PathItemLocation,
}

#[cfg(feature = "testing")]
impl PathItem {
    pub fn new_operational_point(id: &str) -> Self {
        Self {
            id: id.into(),
            location: PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointId {
                    operational_point: id.into(),
                },
                track_reference: None,
            }),
        }
    }
}

/// The location of a path waypoint
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum PathItemLocation {
    TrackOffset(TrackOffset),
    OperationalPointReference(OperationalPointReference),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
pub struct OperationalPointReference {
    pub reference: OperationalPointIdentifier,
    #[serde(default)]
    pub track_reference: Option<TrackReference>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum TrackReference {
    #[schema(title = "TrackReferenceId")]
    Id {
        #[schema(inline)]
        track_id: Identifier,
    },
    #[schema(title = "TrackReferenceName")]
    Name {
        #[schema(inline)]
        track_name: NonBlankString,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum OperationalPointIdentifier {
    #[schema(title = "OperationalPointIdentifierOperationalPointId")]
    OperationalPointId {
        /// The object id of an operational point
        #[schema(inline)]
        operational_point: Identifier,
    },
    #[schema(title = "OperationalPointIdentifierOperationalPointDescription")]
    OperationalPointDescription {
        /// The operational point trigram
        #[schema(inline)]
        trigram: NonBlankString,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
    #[schema(title = "OperationalPointIdentifierOperationalPointUic")]
    OperationalPointUic {
        /// The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point
        uic: u32,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
}
