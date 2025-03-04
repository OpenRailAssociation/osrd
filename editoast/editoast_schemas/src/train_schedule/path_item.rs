use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::infra::TrackOffset;

editoast_common::schemas! {
    PathItem,
    PathItemLocation,
    OperationalPointReference,
    TrackReference,
}

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

/// The location of a path waypoint
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum PathItemLocation {
    TrackOffset(#[schema(inline)] TrackOffset),
    OperationalPointReference(#[schema(inline)] OperationalPointReference),
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, Hash)]
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
