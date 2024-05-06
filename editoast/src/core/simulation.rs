use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockComfortType;
use editoast_schemas::train_schedule::Allowance;
use editoast_schemas::train_schedule::RjsPowerRestrictionRange;
use serde_derive::Deserialize;
use serde_derive::Serialize;
use utoipa::ToSchema;

use super::AsCoreRequest;
use super::Json;
use crate::models::train_schedule::ElectrificationRange;
use crate::models::train_schedule::Mrsp;
use crate::models::train_schedule::SimulationPowerRestrictionRange;
use crate::models::train_schedule::TrainScheduleOptions;
use crate::models::Pathfinding;
use crate::models::PathfindingPayload;
use crate::models::ResultTrain;
use crate::models::RoutePath;
use crate::models::ScheduledPoint;
use crate::models::SignalSighting;
use crate::models::ZoneUpdate;
use editoast_schemas::infra::TrackLocation;

editoast_common::schemas! {
    SignalUpdate,
    TrainStop,
}

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
pub struct CoreTrainSchedule {
    #[serde(rename = "id")]
    pub train_name: String,
    pub rolling_stock: String,
    pub initial_speed: f64,
    pub scheduled_points: Vec<ScheduledPoint>,
    pub allowances: Vec<Allowance>,
    pub stops: Vec<TrainStop>,
    pub tag: Option<String>,
    pub comfort: RollingStockComfortType,
    pub power_restriction_ranges: Option<Vec<RjsPowerRestrictionRange>>,
    pub options: Option<TrainScheduleOptions>,
}

/// One must be specified between `position` and `location`.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct TrainStop {
    #[schema(required)]
    pub position: Option<f64>,
    #[schema(required)]
    pub location: Option<TrackLocation>,
    pub duration: f64,
    pub on_stop_signal: bool,
}

#[derive(Debug, Serialize)]
pub struct SimulationRequest {
    pub infra: i64,
    pub rolling_stocks: Vec<RollingStock>,
    pub train_schedules: Vec<CoreTrainSchedule>,
    pub electrical_profile_set: Option<String>,
    pub trains_path: TrainPath,
}

impl AsCoreRequest<Json<SimulationResponse>> for SimulationRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/standalone_simulation";
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct SimulationResponse {
    pub base_simulations: Vec<ResultTrain>,
    pub eco_simulations: Vec<Option<ResultTrain>>,
    pub speed_limits: Vec<Mrsp>,
    pub warnings: Vec<String>, // TODO
    pub electrification_ranges: Vec<Vec<ElectrificationRange>>,
    pub power_restriction_ranges: Vec<Vec<SimulationPowerRestrictionRange>>,
}

impl SimulationResponse {
    pub fn len(&self) -> usize {
        self.base_simulations.len() // TODO: check on deserialization that all vecs in response have same length
    }
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

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SignalUpdate {
    /// The id of the updated signal
    pub signal_id: String,
    /// The aspects start being displayed at this time (number of seconds since 1970-01-01T00:00:00)
    pub time_start: f64,
    /// The aspects stop being displayed at this time (number of seconds since 1970-01-01T00:00:00)
    #[schema(required)]
    pub time_end: Option<f64>,
    /// The route starts at this position on the train path
    pub position_start: f64,
    /// The route ends at this position on the train path
    #[schema(required)]
    pub position_end: Option<f64>,
    /// The color of the aspect
    ///
    /// (Bits 24-31 are alpha, 16-23 are red, 8-15 are green, 0-7 are blue)
    pub color: i32,
    /// Whether the signal is blinking
    pub blinking: bool,
    /// The labels of the new aspect
    pub aspect_label: String,
    pub track: String,
    #[schema(required)]
    pub track_offset: Option<f64>,
}
