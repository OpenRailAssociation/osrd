mod buffer_stop;
mod catenary;
mod dead_section;
mod detector;
pub mod electrical_profiles;
mod errors;
mod geo_json;
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
pub use dead_section::DeadSection;
use derivative::Derivative;
pub use detector::{Detector, DetectorCache};
use enum_map::Enum;
pub use errors::{InfraError, InfraErrorType};
pub use geo_json::GeoJson;
pub use operational_point::{OperationalPoint, OperationalPointCache, OperationalPointPart};
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

use self::utils::{Identifier, NonBlankString};

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
    Debug, Clone, Copy, Deserialize, Hash, Eq, PartialEq, Serialize, Enum, EnumIter, Display,
)]
#[serde(deny_unknown_fields)]
pub enum ObjectType {
    TrackSection,
    Signal,
    SpeedSection,
    Detector,
    DeadSection,
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
            ObjectType::TrackSection => "osrd_infra_tracksectionmodel",
            ObjectType::Signal => "osrd_infra_signalmodel",
            ObjectType::DeadSection => "osrd_infra_deadsectionmodel",
            ObjectType::SpeedSection => "osrd_infra_speedsectionmodel",
            ObjectType::Detector => "osrd_infra_detectormodel",
            ObjectType::TrackSectionLink => "osrd_infra_tracksectionlinkmodel",
            ObjectType::Switch => "osrd_infra_switchmodel",
            ObjectType::SwitchType => "osrd_infra_switchtypemodel",
            ObjectType::BufferStop => "osrd_infra_bufferstopmodel",
            ObjectType::Route => "osrd_infra_routemodel",
            ObjectType::OperationalPoint => "osrd_infra_operationalpointmodel",
            ObjectType::Catenary => "osrd_infra_catenarymodel",
        }
    }

    /// Returns the layer table name.
    /// Returns `None` for objects that doesn't have a layer such as routes or switch types.
    pub fn get_geometry_layer_table(&self) -> Option<&'static str> {
        match *self {
            ObjectType::TrackSection => Some("osrd_infra_tracksectionlayer"),
            ObjectType::Signal => Some("osrd_infra_signallayer"),
            ObjectType::SpeedSection => Some("osrd_infra_speedsectionlayer"),
            ObjectType::Detector => Some("osrd_infra_detectorlayer"),
            ObjectType::TrackSectionLink => Some("osrd_infra_tracksectionlinklayer"),
            ObjectType::Switch => Some("osrd_infra_switchlayer"),
            ObjectType::BufferStop => Some("osrd_infra_bufferstoplayer"),
            ObjectType::OperationalPoint => Some("osrd_infra_operationalpointlayer"),
            ObjectType::Catenary => Some("osrd_infra_catenarylayer"),
            _ => None,
        }
    }
}

#[derive(Deserialize, Derivative, Serialize, Clone, Debug, PartialEq, Eq, Hash)]
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

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Hash)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields, rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Direction {
    StartToStop,
    StopToStart,
}

#[derive(Debug, Derivative, Copy, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[derivative(Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicableDirections {
    StartToStop,
    StopToStart,
    #[derivative(Default)]
    Both,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum Endpoint {
    Begin,
    End,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[derivative(Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Left,
    Right,
    #[derivative(Default)]
    Center,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
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
