mod buffer_stop;
mod catenary;
mod detector;
pub mod electrical_profiles;
mod errors;
mod geo_json;
mod neutral_section;
pub mod operation;
mod operational_point;
mod railjson;
pub mod rolling_stock;
mod route;
mod signal;
mod speed_section;
mod switch;
mod switch_type;
mod track_section;

mod track_section_link;
pub mod utils;
pub use buffer_stop::{BufferStop, BufferStopCache};
pub use catenary::Catenary;
use derivative::Derivative;
pub use detector::{Detector, DetectorCache};
use enum_map::Enum;
pub use errors::{InfraError, InfraErrorType};
pub use geo_json::GeoJson;
pub use neutral_section::NeutralSection;
pub use operational_point::{
    OperationalPoint, OperationalPointCache, OperationalPointExtensions,
    OperationalPointIdentifierExtension, OperationalPointPart,
};
pub use railjson::{find_objects, RailJson, RailjsonError};
pub use route::Route;
use serde::{Deserialize, Serialize};
pub use signal::{LogicalSignal, Signal, SignalCache, SignalExtensions, SignalSncfExtension};
pub use speed_section::SpeedSection;
use strum_macros::Display;
use strum_macros::EnumIter;
pub use switch::{Switch, SwitchCache};
pub use switch_type::{SwitchPortConnection, SwitchType};
pub use track_section::{Curve, Slope, TrackSection, TrackSectionCache};
pub use track_section_link::TrackSectionLink;
use utoipa::ToSchema;

use crate::schemas;

use self::utils::{Identifier, NonBlankString};

schemas! {
    ObjectRef,
    ObjectType,
    Waypoint,
    DirectionalTrackRange,
    ApplicableDirectionsTrackRange,
    Direction,
    ApplicableDirections,
    Endpoint,
    TrackEndpoint,
    Side,
    Panel,

    utils::schemas(),
    errors::schemas(),
    railjson::schemas(),
    operation::schemas(),

    operational_point::schemas(),
    signal::schemas(),
    switch::schemas(),
    switch_type::schemas(),
    track_section::schemas(),
    track_section_link::schemas(),
    speed_section::schemas(),
    neutral_section::schemas(),
    detector::schemas(),
    catenary::schemas(),
    buffer_stop::schemas(),
    route::schemas(),
}

/// This trait should be implemented by all struct that represents an OSRD type.
pub trait OSRDTyped {
    fn get_type() -> ObjectType;
}

/// This trait should be implemented by all OSRD objects that can be identified.
pub trait OSRDIdentified {
    fn get_id(&self) -> &String;
}

/// This trait is used for all object that can be typed and identified.
/// It allows to get an `ObjectRef` fromt it.
pub trait OSRDObject: OSRDIdentified {
    fn get_type(&self) -> ObjectType;
    fn get_ref(&self) -> ObjectRef {
        ObjectRef::new(self.get_type(), self.get_id())
    }
}

impl<T: OSRDIdentified + OSRDTyped> OSRDObject for T {
    fn get_type(&self) -> ObjectType {
        T::get_type()
    }
}

#[derive(
    Debug,
    Clone,
    Copy,
    Deserialize,
    Hash,
    Eq,
    PartialEq,
    Serialize,
    Enum,
    EnumIter,
    Display,
    ToSchema,
)]
#[serde(deny_unknown_fields)]
pub enum ObjectType {
    TrackSection,
    Signal,
    SpeedSection,
    Detector,
    NeutralSection,
    TrackSectionLink,
    Switch,
    SwitchType,
    BufferStop,
    Route,
    OperationalPoint,
    Catenary,
}

impl ObjectType {
    pub fn get_table(&self) -> &'static str {
        match *self {
            ObjectType::TrackSection => "infra_object_track_section",
            ObjectType::Signal => "infra_object_signal",
            ObjectType::NeutralSection => "infra_object_neutral_section",
            ObjectType::SpeedSection => "infra_object_speed_section",
            ObjectType::Detector => "infra_object_detector",
            ObjectType::TrackSectionLink => "infra_object_track_section_link",
            ObjectType::Switch => "infra_object_switch",
            ObjectType::SwitchType => "infra_object_switch_type",
            ObjectType::BufferStop => "infra_object_buffer_stop",
            ObjectType::Route => "infra_object_route",
            ObjectType::OperationalPoint => "infra_object_operational_point",
            ObjectType::Catenary => "infra_object_catenary",
        }
    }

    /// Returns the layer table name.
    /// Returns `None` for objects that doesn't have a layer such as routes or switch types.
    pub fn get_geometry_layer_table(&self) -> Option<&'static str> {
        match *self {
            ObjectType::TrackSection => Some("infra_layer_track_section"),
            ObjectType::Signal => Some("infra_layer_signal"),
            ObjectType::SpeedSection => Some("infra_layer_speed_section"),
            ObjectType::Detector => Some("infra_layer_detector"),
            ObjectType::TrackSectionLink => Some("infra_layer_track_section_link"),
            ObjectType::Switch => Some("infra_layer_switch"),
            ObjectType::BufferStop => Some("infra_layer_buffer_stop"),
            ObjectType::OperationalPoint => Some("infra_layer_operational_point"),
            ObjectType::Catenary => Some("infra_layer_catenary"),
            _ => None,
        }
    }
}

#[derive(Deserialize, Derivative, Serialize, Clone, Debug, PartialEq, Eq, Hash, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct ObjectRef {
    #[serde(rename = "type")]
    #[derivative(Default(value = "ObjectType::TrackSection"))]
    pub obj_type: ObjectType,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub obj_id: String,
}

impl ObjectRef {
    pub fn new<T: AsRef<str>>(obj_type: ObjectType, obj_id: T) -> Self {
        let obj_id: String = obj_id.as_ref().to_string();
        ObjectRef { obj_type, obj_id }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Hash, ToSchema)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum Waypoint {
    BufferStop { id: Identifier },
    Detector { id: Identifier },
}

impl Waypoint {
    /// Create a new detector stop waypoint
    pub fn new_detector<T: AsRef<str>>(detector: T) -> Self {
        Self::Detector {
            id: detector.as_ref().into(),
        }
    }

    /// Create a new buffer stop waypoint
    pub fn new_buffer_stop<T: AsRef<str>>(bf: T) -> Self {
        Self::BufferStop {
            id: bf.as_ref().into(),
        }
    }

    /// Return whether the waypoint is a detector
    pub fn is_detector(&self) -> bool {
        matches!(self, Waypoint::Detector { .. })
    }

    // Return whether the waypoint is a buffer stop
    pub fn is_buffer_stop(&self) -> bool {
        matches!(self, Waypoint::BufferStop { .. })
    }
}

impl Default for Waypoint {
    fn default() -> Self {
        Self::Detector {
            id: "InvalidRef".into(),
        }
    }
}

impl OSRDIdentified for Waypoint {
    fn get_id(&self) -> &String {
        match self {
            Waypoint::BufferStop { id } => id,
            Waypoint::Detector { id } => id,
        }
    }
}

impl OSRDObject for Waypoint {
    fn get_type(&self) -> ObjectType {
        match self {
            Waypoint::BufferStop { .. } => ObjectType::BufferStop,
            Waypoint::Detector { .. } => ObjectType::Detector,
        }
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct DirectionalTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
}

impl DirectionalTrackRange {
    pub fn entry_bound(&self) -> f64 {
        match self.direction {
            Direction::StartToStop => self.begin,
            Direction::StopToStart => self.end,
        }
    }

    pub fn get_begin(&self) -> f64 {
        if self.direction == Direction::StartToStop {
            self.begin
        } else {
            self.end
        }
    }

    pub fn get_end(&self) -> f64 {
        if self.direction == Direction::StartToStop {
            self.end
        } else {
            self.begin
        }
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct ApplicableDirectionsTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    pub applicable_directions: ApplicableDirections,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[serde(deny_unknown_fields, rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Direction {
    StartToStop,
    StopToStart,
}

#[derive(Debug, Derivative, Copy, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[derivative(Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicableDirections {
    StartToStop,
    StopToStart,
    #[derivative(Default)]
    Both,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum Endpoint {
    Begin,
    End,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct TrackEndpoint {
    #[derivative(Default(value = "Endpoint::Begin"))]
    pub endpoint: Endpoint,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
}

impl TrackEndpoint {
    /// Create a new `TrackEndpoint` from a track id and an endpoint.
    pub fn new<T: AsRef<str>>(track: T, endpoint: Endpoint) -> Self {
        TrackEndpoint {
            track: track.as_ref().into(),
            endpoint,
        }
    }

    /// Create a `TrackEndpoint` from a track id and a direction.
    pub fn from_track_and_direction<T: AsRef<str>>(track: T, dir: Direction) -> TrackEndpoint {
        let endpoint = match dir {
            Direction::StartToStop => Endpoint::End,
            Direction::StopToStart => Endpoint::Begin,
        };
        TrackEndpoint {
            track: track.as_ref().into(),
            endpoint,
        }
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[derivative(Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Left,
    Right,
    #[derivative(Default)]
    Center,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct Panel {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    pub angle_geo: f64,
    pub angle_sch: f64,
    pub side: Side,
    #[serde(rename = "type")]
    pub panel_type: NonBlankString,
    pub value: Option<NonBlankString>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct TrackLocation {
    pub track_section: Identifier,
    pub offset: f64,
}
