pub mod operation;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Hash, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub enum ObjectType {
    TrackSection,
    Signal,
    SpeedSection,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
pub struct ObjectRef {
    pub obj_type: ObjectType,
    pub obj_id: String,
}

impl ObjectRef {
    pub fn new(obj_type: ObjectType, obj_id: String) -> Self {
        ObjectRef { obj_type, obj_id }
    }
}

impl ObjectType {
    pub fn get_table(&self) -> &str {
        match *self {
            ObjectType::TrackSection => "osrd_infra_tracksectionmodel",
            ObjectType::Signal => "osrd_infra_signalmodel",
            ObjectType::SpeedSection => "osrd_infra_speedsectionmodel",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(deny_unknown_fields)]
pub struct TrackSection {
    pub id: String,
    pub length: f64,
    pub line_code: i32,
    pub line_name: String,
    pub track_number: i32,
    pub track_name: String,
    pub navigability: ApplicableDirections,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    pub geo: LineString,
    pub sch: LineString,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct Signal {
    pub id: String,
    pub direction: Directions,
    pub sight_distance: f64,
    pub linked_detector: Option<ObjectRef>,
    pub aspects: Option<Vec<String>>,
    pub angle_sch: Option<f64>,
    pub angle_geo: Option<f64>,
    pub type_code: Option<String>,
    pub support_type: Option<String>,
    pub is_in_service: Option<bool>,
    pub is_lightable: Option<bool>,
    pub is_operational: Option<bool>,
    pub comment: Option<String>,
    pub physical_organization_group: Option<String>,
    pub responsible_group: Option<String>,
    pub label: Option<String>,
    pub installation_type: Option<String>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct SpeedSection {
    pub id: String,
    pub speed: f64,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ApplicableDirectionsTrackRange {
    pub track: ObjectRef,
    pub begin: f64,
    pub end: f64,
    pub applicable_directions: ApplicableDirections,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum LineString {
    LineString { coordinates: Vec<[f64; 2]> },
}

impl Default for LineString {
    fn default() -> Self {
        LineString::LineString {
            coordinates: vec![[0., 0.], [1., 1.]],
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub enum Directions {
    #[serde(rename = "START_TO_STOP")]
    StartToStop,
    #[serde(rename = "STOP_TO_START")]
    StopToStart,
}

impl Default for Directions {
    fn default() -> Self {
        Directions::StartToStop
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum ApplicableDirections {
    #[serde(rename = "START_TO_STOP")]
    StartToStop,
    #[serde(rename = "STOP_TO_START")]
    StopToStart,
    #[serde(rename = "BOTH")]
    Both,
}

impl Default for ApplicableDirections {
    fn default() -> Self {
        ApplicableDirections::Both
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Curve {
    pub radius: f64,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    pub begin: f64,
    pub end: f64,
}
