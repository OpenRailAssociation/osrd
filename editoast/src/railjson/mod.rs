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
