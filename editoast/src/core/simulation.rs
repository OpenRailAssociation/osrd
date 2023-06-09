use super::{AsCoreRequest, Json};
use crate::models::{
    Pathfinding, PathfindingPayload, ResultTrain, RoutePath, SignalSighting, TrainSchedule,
    ZoneUpdate,
};
use crate::schema::rolling_stock::RollingStock;
use geos::geojson::JsonValue;
use serde_derive::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct TrainPath {
    pub route_paths: Vec<RoutePath>,
}

impl From<Pathfinding> for TrainPath {
    fn from(value: Pathfinding) -> Self {
        TrainPath {
            route_paths: value.payload.route_paths.to_owned(),
        }
    }
}

impl From<&PathfindingPayload> for TrainPath {
    fn from(value: &PathfindingPayload) -> Self {
        TrainPath {
            route_paths: value.route_paths.to_owned(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SimulationRequest {
    pub infra: i64,
    pub rolling_stocks: Vec<RollingStock>,
    pub train_schedules: Vec<TrainSchedule>,
    pub electrical_profile_set: Option<String>,
    pub trains_path: TrainPath,
}

impl AsCoreRequest<Json<SimulationResponse>> for SimulationRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/standalone_simulation";
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationResponse {
    pub base_simulations: Vec<ResultTrain>,
    pub eco_simulations: Vec<ResultTrain>,
    pub speed_limits: Vec<JsonValue>,
    pub warnings: Vec<String>, // TODO
    pub electrification_conditions: Vec<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct SignalProjectionRequest {
    pub infra: String,
    pub train_path: TrainPath,
    pub signal_sightings: Vec<SignalSighting>,
    pub zone_updates: Vec<ZoneUpdate>,
}

impl AsCoreRequest<Json<SignalProjectionResponse>> for SignalProjectionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/project_signals";
}

#[derive(Debug, Deserialize)]
pub struct SignalProjectionResponse {
    pub signal_updates: Vec<SignalUpdate>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignalUpdate {
    pub signal_id: String,
    pub time_start: f64,
    pub time_end: Option<f64>,
    pub position_start: f64,
    pub position_end: Option<f64>,
    pub color: i32,
    pub blinking: bool,
    pub aspect_label: String,
    pub track: String,
    pub track_offset: Option<f64>,
}
