pub mod operation;

use std::collections::HashMap;

use derivative::Derivative;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};

use crate::models::BoundingBox;

fn generate_id(prefix: &str) -> String {
    format!(
        "{}_{}",
        prefix,
        (0..10)
            .map(|_| thread_rng().sample(Alphanumeric) as char)
            .collect::<String>(),
    )
}

#[derive(Debug, Clone, Copy, Deserialize, Hash, Eq, PartialEq, Serialize)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSection {
    #[derivative(Default(value = r#"generate_id("track_section")"#))]
    pub id: String,
    #[derivative(Default(value = "0."))]
    pub length: f64,
    pub line_code: i32,
    #[derivative(Default(value = r#""line_test".to_string()"#))]
    pub line_name: String,
    pub track_number: i32,
    #[derivative(Default(value = r#""track_test".to_string()"#))]
    pub track_name: String,
    pub navigability: ApplicableDirections,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    pub loading_gauge_limits: Vec<LoadingGaugeLimit>,
    pub geo: LineString,
    pub sch: LineString,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Signal {
    #[derivative(Default(value = r#"generate_id("signal")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
    pub position: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
    #[derivative(Default(value = "400."))]
    pub sight_distance: f64,
    pub linked_detector: Option<ObjectRef>,
    pub aspects: Option<Vec<String>>,
    pub angle_sch: f64,
    pub angle_geo: f64,
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
    pub side: Side,
    pub default_aspect: String,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SpeedSection {
    #[derivative(Default(value = r#"generate_id("speed_section")"#))]
    pub id: String,
    #[derivative(Default(value = "Some(80.)"))]
    pub speed_limit: Option<f64>,
    pub speed_limit_by_tag: HashMap<String, f64>,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

/* temporary object ref on a traksection for tests */
#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: ObjectRef,
    pub exit_point: ObjectRef,
    pub release_detectors: Vec<ObjectRef>,
    pub path: Vec<DirectionalTrackRange>,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionLink {
    #[derivative(Default(value = r#"generate_id("track_section_link")"#))]
    pub id: String,
    pub src: TrackEndpoint,
    pub dst: TrackEndpoint,
    pub navigability: ApplicableDirections,
}

/* temporary object ref on a traksection for tests */
#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Switch {
    #[derivative(Default(value = r#"generate_id("switch")"#))]
    pub id: String,
    pub switch_type: ObjectRef,
    pub group_change_delay: f64,
    pub ports: HashMap<String, TrackEndpoint>,
    pub label: String,
}

/* temporary object ref on a traksection for tests */
#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchType {
    #[derivative(Default(value = r#"generate_id("switchtype")"#))]
    pub id: String,
    pub ports: Vec<String>,
    pub groups: HashMap<String, Vec<SwitchPortConnection>>,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchPortConnection {
    pub src: String,
    pub dst: String,
    pub bidirectional: bool,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Detector {
    #[derivative(Default(value = r#"generate_id("detector")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct BufferStop {
    #[derivative(Default(value = r#"generate_id("buffer_stop")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct OperationalPoint {
    #[derivative(Default(value = r#"generate_id("operational_point")"#))]
    pub id: String,
    pub parts: Vec<OperationalPointPart>,
    pub uic: i64,
    pub ci: i64,
    pub ch: String,
    pub ch_short_label: Option<String>,
    pub ch_long_label: Option<String>,
    pub name: String,
    pub trigram: String,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct OperationalPointPart {
    pub track: ObjectRef,
    pub position: f64,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct ApplicableDirectionsTrackRange {
    pub track: ObjectRef,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    pub applicable_directions: ApplicableDirections,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct DirectionalTrackRange {
    pub track: ObjectRef,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(tag = "type", deny_unknown_fields)]
#[derivative(Default)]
pub enum LineString {
    #[derivative(Default)]
    LineString {
        #[derivative(Default(value = "vec![[0., 0.], [1., 1.]]"))]
        coordinates: Vec<[f64; 2]>,
    },
}

impl LineString {
    pub fn get_bbox(&self) -> BoundingBox {
        let coords = match self {
            Self::LineString { coordinates } => coordinates,
        };

        let mut min: (f64, f64) = (f64::MAX, f64::MAX);
        let mut max: (f64, f64) = (f64::MIN, f64::MIN);
        for p in coords {
            min.0 = min.0.min(p[0]);
            max.0 = max.0.max(p[0]);
            min.1 = min.1.min(p[1]);
            max.1 = max.1.max(p[1]);
        }
        BoundingBox(min, max)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub enum Direction {
    #[serde(rename = "START_TO_STOP")]
    StartToStop,
    #[serde(rename = "STOP_TO_START")]
    StopToStart,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
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
    pub track: ObjectRef,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum ApplicableTrainType {
    #[serde(rename = "FREIGHT")]
    Freight,
    #[serde(rename = "PASSENGER")]
    Passenger,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum LoadingGaugeType {
    G1,
    G2,
    GA,
    GB,
    GB1,
    GC,
    #[serde(rename = "FR3.3")]
    Fr3_3,
    #[serde(rename = "FR3.3/GB/G2")]
    Fr3_3GbG2,
    #[serde(rename = "GLOTT")]
    Glott,
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LoadingGaugeLimit {
    pub category: LoadingGaugeType,
    pub applicable_train_type: ApplicableTrainType,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Catenary {
    #[derivative(Default(value = r#"generate_id("catenary")"#))]
    pub id: String,
    pub voltage: f64,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

#[cfg(test)]
mod tests {
    use crate::models::BoundingBox;

    use super::LineString::LineString;

    /// Test bounding box from linestring
    #[test]
    fn test_line_string_bbox() {
        let line_string = LineString {
            coordinates: vec![
                [2.4, 49.3],
                [2.6, 49.1],
                [2.8, 49.2],
                [3.0, 49.1],
                [2.6, 49.0],
            ],
        };

        assert_eq!(
            line_string.get_bbox(),
            BoundingBox((2.4, 49.0), (3.0, 49.3))
        );
    }
}
