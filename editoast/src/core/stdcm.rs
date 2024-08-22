use std::collections::HashMap;

use crate::core::simulation::RoutingRequirement;
use crate::core::simulation::SpacingRequirement;
use chrono::DateTime;
use chrono::Utc;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::MarginValue;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::pathfinding::PathfindingResultSuccess;
use super::simulation::PhysicsRollingStock;
use super::simulation::SimulationResponse;
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
    /// List of supported signaling systems
    pub rolling_stock_supported_signaling_systems: RollingStockSupportedSignalingSystems,

    // Simulation inputs
    /// The comfort of the train
    pub comfort: Comfort,
    pub speed_limit_tag: Option<String>,
    pub rolling_stock: PhysicsRollingStock,

    // STDCM search parameters
    pub trains_requirements: HashMap<i64, TrainRequirement>,
    /// Numerical integration time step in milliseconds. Use default value if not specified.
    pub time_step: Option<u64>,
    pub start_time: DateTime<Utc>,
    /// Maximum departure delay in milliseconds.
    pub maximum_departure_delay: u64,
    /// Maximum run time of the simulation in milliseconds
    pub maximum_run_time: u64,
    /// Gap between the created train and previous trains in milliseconds
    pub time_gap_before: u64,
    /// Gap between the created train and following trains in milliseconds
    pub time_gap_after: u64,
    /// Margin to apply to the whole train
    pub margin: Option<MarginValue>,
    /// List of planned work schedules
    pub work_schedules: Vec<STDCMWorkSchedule>,
}

#[derive(Debug, Serialize)]
pub struct STDCMPathItem {
    /// The track offsets of the path item
    pub locations: Vec<TrackOffset>,
    /// Stop duration in milliseconds. None if the train does not stop at this path item.
    pub stop_duration: Option<u64>,
    /// If specified, describes when the train may arrive at the location
    pub step_timing_data: Option<STDCMStepTimingData>,
}

/// Contains the data of a step timing, when it is specified
#[derive(Debug, Serialize)]
pub struct STDCMStepTimingData {
    /// Time the train should arrive at this point
    pub arrival_time: DateTime<Utc>,
    /// Tolerance for the arrival time, when it arrives before the expected time, in ms
    pub arrival_time_tolerance_before: u64,
    /// Tolerance for the arrival time, when it arrives after the expected time, in ms
    pub arrival_time_tolerance_after: u64,
}

/// Lighter description of a work schedule, only contains what's relevant
#[derive(Debug, Serialize)]
pub struct STDCMWorkSchedule {
    /// Start time as a time delta from the stdcm start time in ms
    pub start_time: u64,
    /// End time as a time delta from the stdcm start time in ms
    pub end_time: u64,
    /// List of unavailable track ranges
    pub track_ranges: Vec<UndirectedTrackRange>,
}

/// A range on a track section.
/// `begin` is always less than `end`.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq)]
pub struct UndirectedTrackRange {
    /// The track section identifier.
    pub track_section: String,
    /// The beginning of the range in mm.
    pub begin: u64,
    /// The end of the range in mm.
    pub end: u64,
}

#[derive(Debug, Serialize)]
pub struct TrainRequirement {
    /// The start datetime of the train
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
pub enum STDCMResponse {
    Success {
        simulation: SimulationResponse,
        path: PathfindingResultSuccess,
        departure_time: DateTime<Utc>,
    },
    PathNotFound,
    PreprocessingSimulationError {
        error: SimulationResponse,
    },
}

impl AsCoreRequest<Json<STDCMResponse>> for STDCMRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/stdcm";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
