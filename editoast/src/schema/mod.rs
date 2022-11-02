mod buffer_stop;
mod catenary;
mod detector;
mod errors;
pub mod operation;
mod operational_point;
mod railjson;
mod route;
mod signal;
mod speed_section;
mod switch;
mod switch_type;
mod track_section;
mod track_section_link;
pub use buffer_stop::{BufferStop, BufferStopCache};
pub use catenary::Catenary;
use derivative::Derivative;
pub use detector::{Detector, DetectorCache};
use enum_map::Enum;
pub use errors::{InfraError, PathEndpointField};
pub use operational_point::{OperationalPoint, OperationalPointCache, OperationalPointPart};
pub use railjson::{find_objects, RailJson, RailjsonError};
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
pub use route::Route;
use serde::{Deserialize, Serialize};
pub use signal::{Signal, SignalCache};
pub use speed_section::SpeedSection;
pub use switch::{Switch, SwitchCache};
pub use switch_type::{SwitchPortConnection, SwitchType};
pub use track_section::{LineString, TrackSection, TrackSectionCache};
pub use track_section_link::TrackSectionLink;

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

fn generate_id(prefix: &str) -> String {
    format!(
        "{}_{}",
        prefix,
        (0..10)
            .map(|_| thread_rng().sample(Alphanumeric) as char)
            .collect::<String>(),
    )
}

#[derive(Debug, Clone, Copy, Deserialize, Hash, Eq, PartialEq, Serialize, Enum)]
#[serde(deny_unknown_fields)]
pub enum ObjectType {
    TrackSection,
    Signal,
    SpeedSection,
    Detector,
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
}

#[derive(Deserialize, Derivative, Serialize, Clone, Debug, PartialEq, Eq, Hash)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct ObjectRef {
    #[serde(rename = "type")]
    #[derivative(Default(value = "ObjectType::TrackSection"))]
    pub obj_type: ObjectType,
    #[serde(rename = "id")]
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
    BufferStop { id: String },
    Detector { id: String },
}

impl Waypoint {
    pub fn new_detector<T: AsRef<str>>(detector: T) -> Self {
        Self::Detector {
            id: detector.as_ref().into(),
        }
    }
    pub fn new_buffer_stop<T: AsRef<str>>(bf: T) -> Self {
        Self::BufferStop {
            id: bf.as_ref().into(),
        }
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
pub struct ApplicableDirectionsTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    pub applicable_directions: ApplicableDirections,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct DirectionalTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
}

impl DirectionalTrackRange {
    pub fn get_begin(&self) -> TrackEndpoint {
        TrackEndpoint {
            endpoint: match self.direction {
                Direction::StartToStop => Endpoint::Begin,
                Direction::StopToStart => Endpoint::End,
            },
            track: self.track.clone(),
        }
    }

    pub fn get_end(&self) -> TrackEndpoint {
        TrackEndpoint {
            endpoint: match self.direction {
                Direction::StartToStop => Endpoint::End,
                Direction::StopToStart => Endpoint::Begin,
            },
            track: self.track.clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum Direction {
    #[serde(rename = "START_TO_STOP")]
    StartToStop,
    #[serde(rename = "STOP_TO_START")]
    StopToStart,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[derivative(Default)]
pub enum ApplicableDirections {
    #[serde(rename = "START_TO_STOP")]
    StartToStop,
    #[serde(rename = "STOP_TO_START")]
    StopToStart,
    #[serde(rename = "BOTH")]
    #[derivative(Default)]
    Both,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
pub enum Endpoint {
    #[serde(rename = "BEGIN")]
    Begin,
    #[serde(rename = "END")]
    End,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackEndpoint {
    #[derivative(Default(value = "Endpoint::Begin"))]
    pub endpoint: Endpoint,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[derivative(Default)]
pub enum Side {
    #[serde(rename = "LEFT")]
    Left,
    #[serde(rename = "RIGHT")]
    Right,
    #[serde(rename = "CENTER")]
    #[derivative(Default)]
    Center,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Panel {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: String,
    pub position: f64,
    pub angle_geo: f64,
    pub angle_sch: f64,
    pub side: Side,
    #[serde(rename = "type")]
    pub panel_type: String,
    pub value: Option<String>,
}
