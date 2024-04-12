mod buffer_stop;
mod detector;
pub mod electrical_profiles;
mod electrification;
mod errors;
mod neutral_section;
pub mod operational_point;
mod railjson;
mod route;
mod signal;
mod speed_section;
mod switch;
mod switch_type;
pub mod track_section;
pub mod utils;
pub mod v2;

pub use buffer_stop::BufferStop;
pub use buffer_stop::BufferStopCache;
pub use detector::Detector;
pub use detector::DetectorCache;
use editoast_schemas::infra::Direction;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::ObjectType;
pub use electrification::Electrification;
pub use errors::InfraError;
pub use errors::InfraErrorType;
pub use neutral_section::NeutralSection;
pub use operational_point::OperationalPoint;
pub use operational_point::OperationalPointCache;
pub use operational_point::OperationalPointExtensions;
pub use operational_point::OperationalPointIdentifierExtension;
pub use operational_point::OperationalPointPart;
pub use railjson::RailJson;
pub use railjson::RAILJSON_VERSION;
pub use route::Route;
pub use signal::LogicalSignal;
pub use signal::Signal;
pub use signal::SignalCache;
pub use signal::SignalExtensions;
pub use signal::SignalSncfExtension;
pub use speed_section::Speed;
pub use speed_section::SpeedSection;
pub use switch::Switch;
pub use switch::SwitchCache;
pub use switch_type::builtin_node_types_list;
pub use switch_type::Crossing;
pub use switch_type::DoubleSlipSwitch;
pub use switch_type::Link;
pub use switch_type::PointSwitch;
pub use switch_type::SingleSlipSwitch;
pub use switch_type::SwitchType;
pub use track_section::TrackSection;
pub use track_section::TrackSectionCache;

cfg_if! {
    if #[cfg(test)] {
        pub use operational_point::OperationalPointPartCache;
        pub use switch_type::SwitchPortConnection;
        pub use track_section::{Curve, Slope};
        pub use buffer_stop::BufferStopExtension;
    }
}

use crate::infra_cache::operation;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_common::Identifier;
use editoast_common::NonBlankString;

editoast_common::schemas! {
    DirectionalTrackRange,
    utils::schemas(),
    editoast_schemas::schemas(),
    operation::schemas(),
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct DirectionalTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
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

    pub fn new<T: AsRef<str>>(track: T, begin: f64, end: f64, direction: Direction) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
            direction,
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

impl ApplicableDirectionsTrackRange {
    pub fn new<T: AsRef<str>>(
        track: T,
        begin: f64,
        end: f64,
        applicable_directions: ApplicableDirections,
    ) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
            applicable_directions,
        }
    }
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
pub struct Sign {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    pub side: Side,
    #[derivative(Default(value = r#"Direction::StartToStop"#))]
    pub direction: Direction,
    #[serde(rename = "type")]
    pub sign_type: NonBlankString,
    pub value: String,
    pub kp: String,
}
