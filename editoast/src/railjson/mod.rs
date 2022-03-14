pub mod operation;

use rocket::serde::Deserialize;

#[derive(Clone, Deserialize, Hash, Eq, PartialEq)]
#[serde(crate = "rocket::serde")]
pub enum ObjectType {
    TrackSection,
}

impl ObjectType {
    pub fn get_table(&self) -> &str {
        match self {
            &ObjectType::TrackSection => "osrd_infra_tracksectionmodel",
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct TrackSection {
    pub id: String,
    pub length: f32,
    pub line_code: i32,
    pub line_name: String,
    pub track_number: i32,
    pub track_name: String,
    pub navigability: ApplicableDirections,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub enum ApplicableDirections {
    #[serde(rename = "START_TO_STOP")]
    StartToStop,
    #[serde(rename = "STOP_TO_START")]
    StopToStart,
    #[serde(rename = "BOTH")]
    Both,
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct Curve {
    pub radius: f32,
    pub begin: f32,
    pub end: f32,
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct Slope {
    pub gradient: f32,
    pub begin: f32,
    pub end: f32,
}
