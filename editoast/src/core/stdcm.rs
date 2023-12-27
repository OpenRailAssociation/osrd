use serde::{Deserialize, Serialize};

use crate::models::{RollingStockModel, SpacingRequirement};

use crate::core::{pathfinding::Waypoint, simulation::SimulationResponse};
use crate::schema::rolling_stock::RollingStockComfortType;
use crate::views::stdcm::AllowanceValue;

use super::pathfinding::PathfindingResult;
use super::{AsCoreRequest, Json};

#[derive(Serialize, Deserialize, Debug)]
pub struct STDCMCoreRequest {
    pub infra: String,
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
    pub path: PathfindingResult,
    pub departure_time: f64,
}
