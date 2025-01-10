use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::BufferStop;
use super::Detector;
use super::Electrification;
use super::NeutralSection;
use super::OperationalPoint;
use super::Route;
use super::Signal;
use super::SpeedSection;
use super::Switch;
use super::SwitchType;
use super::TrackSection;

pub const RAILJSON_VERSION: &str = "3.4.14";

editoast_common::schemas! {
    RailJson,
}

/// An infrastructure description in the RailJson format
#[derive(Deserialize, Derivative, Serialize, Clone, Debug, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct RailJson {
    /// The version of the RailJSON format. Defaults to the current version.
    #[derivative(Default(value = r#"RAILJSON_VERSION.to_string()"#))]
    pub version: String,
    /// Operational point is also known in French as "Point Remarquable" (PR). One `OperationalPoint` is a **collection** of points (`OperationalPointParts`) of interest.
    pub operational_points: Vec<OperationalPoint>,
    /// A `Route` is an itinerary in the infrastructure. A train path is a sequence of routes. Routes are used to reserve section of path with the interlocking.
    pub routes: Vec<Route>,
    /// These define the types of switches available for route management.
    pub extended_switch_types: Vec<SwitchType>,
    /// `Switches` allow for route control and redirection of trains.
    pub switches: Vec<Switch>,
    /// `TrackSection`` is a segment of rail between switches that serves as a bidirectional path for trains, and can be defined as the longest possible stretch of track within a rail infrastructure.
    pub track_sections: Vec<TrackSection>,
    /// The `SpeedSections` represent speed limits (in meters per second) that are applied on some parts of the tracks. One `SpeedSection` can span on several track sections, and do not necessarily cover the whole track sections. Speed sections can overlap.
    pub speed_sections: Vec<SpeedSection>,
    /// `NeutralSections` are designated areas of rail infrastructure where train drivers are instructed to cut the power supply to the train, primarily for safety reasons.
    pub neutral_sections: Vec<NeutralSection>,
    /// To allow electric trains to run on our infrastructure, we need to specify which parts of the infrastructure is electrified.
    pub electrifications: Vec<Electrification>,
    /// `Signals` are devices that visually convey information to train drivers about whether it is safe to proceed, stop, or slow down, based on the interlocking system and the specific signaling rules in place.
    pub signals: Vec<Signal>,
    /// `BufferStops` are obstacles designed to prevent trains from sliding off dead ends.
    pub buffer_stops: Vec<BufferStop>,
    /// `Detector` is a device that identifies the presence of a train in a TVD section (Track Vacancy Detection section), indicating when a track area is occupied.
    pub detectors: Vec<Detector>,
}
