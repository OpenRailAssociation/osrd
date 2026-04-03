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
            location: PathItemLocation::OperationalPointPartReference(
                OperationalPointPartReference {
                    operational_point: OperationalPointReference::Id {
                        operational_point: id.into(),
                    },
                    local_track_name: None,
                },
            ),
        }
    }
}

/// The location of a path waypoint
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum PathItemLocation {
    #[schema(title = "PathItemLocationTrackOffset")]
    TrackOffset(TrackOffset),
    #[schema(title = "PathItemLocationOperationalPointPartReference")]
    OperationalPointPartReference(OperationalPointPartReference),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
pub struct OperationalPointPartReference {
    pub operational_point: OperationalPointReference,
    #[serde(default)]
    #[schema(inline)]
    pub local_track_name: Option<NonBlankString>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
#[serde(tag = "type", rename_all = "lowercase")]
#[schema(title_variants)]
pub enum OperationalPointReference {
    #[schema(title = "OperationalPointReferenceId")]
    Id {
        /// The object id of an operational point
        #[schema(inline)]
        operational_point: Identifier,
    },
    #[schema(title = "OperationalPointReferenceTrigram")]
    Trigram {
        /// The operational point trigram
        #[schema(inline)]
        trigram: NonBlankString,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
    #[schema(title = "OperationalPointReferenceUic")]
    Uic {
        /// The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point
        uic: u32,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
}

impl std::fmt::Display for OperationalPointReference {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Id { operational_point } => write!(f, "id:{operational_point}"),
            Self::Trigram {
                trigram,
                secondary_code: None,
            } => write!(f, "trigram:{trigram}"),
            Self::Trigram {
                trigram,
                secondary_code: Some(secondary_code),
            } => write!(f, "trigram:{trigram}:{secondary_code}"),
            Self::Uic {
                uic,
                secondary_code: None,
            } => write!(f, "uic:{uic}"),
            Self::Uic {
                uic,
                secondary_code: Some(secondary_code),
            } => write!(f, "uic:{uic}:{secondary_code}"),
        }
    }
}
