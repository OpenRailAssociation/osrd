use super::{ApplicableDirections, Curve, LineString, Slope};
use rocket::serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize, Default)]
#[serde(crate = "rocket::serde")]
pub struct TrackSectionChange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_number: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub navigability: Option<ApplicableDirections>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slopes: Option<Vec<Slope>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub curves: Option<Vec<Curve>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geo: Option<LineString>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sch: Option<LineString>,
}
