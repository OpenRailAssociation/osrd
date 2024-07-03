use editoast_schemas::rolling_stock::RollingStockComfortType;
use editoast_schemas::train_schedule::AllowanceValue;
use serde::Deserialize;
use serde::Serialize;

use super::pathfinding::PathfindingResponse;
use super::AsCoreRequest;
use super::Json;
use crate::core::pathfinding::Waypoint;
use crate::core::simulation::SimulationResponse;
use crate::models::SpacingRequirement;
use crate::modelsv2::RollingStockModel;

#[derive(Serialize, Deserialize, Debug)]
pub struct STDCMCoreRequest {
    pub infra: i64,
    pub expected_version: String,
    pub rolling_stock: RollingStockModel,
    pub comfort: RollingStockComfortType,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub steps: Vec<STDCMCoreStep>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<f64>,
    pub time_step: Option<f64>,
    pub maximum_departure_delay: Option<f64>,
    pub maximum_run_time: f64,
    pub speed_limit_tags: Option<String>,
    pub margin_before: f64,
    pub margin_after: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub standard_allowance: Option<AllowanceValue>,
}

impl AsCoreRequest<Json<STDCMCoreResponse>> for STDCMCoreRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/stdcm";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct STDCMCoreStep {
    pub stop_duration: f64,
    pub stop: bool,
    pub waypoints: Vec<Waypoint>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct STDCMCoreResponse {
    pub simulation: SimulationResponse,
    pub path: PathfindingResponse,
    pub departure_time: f64,
}
