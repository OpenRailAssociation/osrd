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
    /// Metadata given to mark a point as wishing to be deleted by the user.
    /// It's useful for soft deleting the point (waiting to fix / remove all references)
    /// If true, the train schedule is consider as invalid and must be edited
    #[serde(default)]
    pub deleted: bool,
    #[serde(flatten)]
    pub location: PathItemLocation,
}

#[cfg(feature = "testing")]
impl PathItem {
    pub fn new_operational_point(id: &str) -> Self {
        Self {
            id: id.into(),
            deleted: false,
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
    #[serde(flatten)]
    #[schema(inline)]
    pub reference: OperationalPointIdentifier,
    #[serde(default)]
    pub track_reference: Option<TrackReference>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum TrackReference {
    Id {
        #[schema(inline)]
        track_id: Identifier,
    },
    Name {
        #[schema(inline)]
        track_name: NonBlankString,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum OperationalPointIdentifier {
    OperationalPointId {
        /// The object id of an operational point
        #[schema(inline)]
        operational_point: Identifier,
    },
    OperationalPointDescription {
        /// The operational point trigram
        #[schema(inline)]
        trigram: NonBlankString,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
    OperationalPointUic {
        /// The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point
        uic: u32,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
}

impl PathItemLocation {
    pub fn identifier(&self) -> Option<&str> {
        match self {
            Self::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointId { operational_point },
                ..
            }) => Some(operational_point.as_str()),
            _ => None,
        }
    }
}
