use std::collections::HashMap;

use chrono::DateTime;
use chrono::Utc;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::MarginValue;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::pathfinding::PathfindingResultSuccess;
use super::simulation::PhysicsRollingStock;
use crate::core::simulation::SimulationResponse;
use crate::core::{AsCoreRequest, Json};

#[derive(Debug, Serialize)]
pub struct STDCMRequest {
    /// Infrastructure id
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: String,

    // Pathfinding inputs
    /// List of waypoints. Each waypoint is a list of track offset.
    pub path_items: Vec<STDCMPathItem>,
    /// The loading gauge of the rolling stock
    pub rolling_stock_loading_gauge: LoadingGaugeType,
    /// Can the rolling stock run on non-electrified tracks
    pub rolling_stock_is_thermal: bool,
    /// List of supported electrification modes.
    /// Empty if does not support any electrification
    pub rolling_stock_supported_electrifications: Vec<String>,
    /// List of supported signaling systems
    pub rolling_stock_supported_signaling_systems: Vec<String>,

    // Simulation inputs
    /// The comfort of the train
    pub comfort: Comfort,
    pub speed_limit_tag: Option<String>,
    pub rolling_stock: PhysicsRollingStock,

    // STDCM search parameters
    pub train_requirements: HashMap<i64, TrainRequirement>,
    /// Numerical integration time step in milliseconds. Use default value if not specified.
    pub time_step: Option<u64>,
    pub start_time: DateTime<Utc>,
    /// Maximum departure delay in milliseconds. Use default value if not specified.
    pub maximum_departure_delay: Option<u64>,
    /// Maximum run time of the simulation in milliseconds
    pub maximum_run_time: u64,
    /// Gap between the created train and previous trains in milliseconds
    pub time_gap_before: u64,
    /// Gap between the created train and following trains in milliseconds
    pub time_gap_after: u64,
    /// Margin to apply to the whole train
    pub margin: MarginValue,
}

pub struct STDCMPathItem {
    /// The track offsets of the path item
    locations: Vec<TrackOffset>,
    /// Stop duration in milliseconds. None if the train does not stop at this path item.
    stop_duration: Option<u64>,
}

pub struct TrainRequirement {
    /// The start datetime of the train
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum STDCMResponse {
    Success {
        simulation: SimulationResponse,
        pathfinding: PathfindingResultSuccess,
    },
    NotFound,
}

impl AsCoreRequest<Json<STDCMResponse>> for STDCMRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/stdcm";
}
