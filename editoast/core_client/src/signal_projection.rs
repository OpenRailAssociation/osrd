use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AsCoreRequest;
use crate::Json;
use crate::simulation::SignalCriticalPosition;
use crate::simulation::ZoneUpdate;

use super::pathfinding::TrainPath;

#[derive(Debug, Serialize)]
pub struct SignalUpdatesRequest<'a> {
    /// Infrastructure id
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: i64,
    /// Path description as track ranges
    pub path: &'a TrainPath,
    /// List of signal critical positions and zone updates for each train
    pub train_simulations: Vec<TrainSimulation<'a>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SignalUpdate {
    /// The id of the updated signal
    pub signal_id: String,
    /// The name of the signaling system of the signal
    signaling_system: String,
    /// The aspects start being displayed at this time (number of ms since `departure_time`)
    pub time_start: u64,
    /// The aspects stop being displayed at this time (number of ms since `departure_time`)
    pub time_end: u64,
    /// The route starts at this position in mm on the train path
    pub position_start: u64,
    /// The route ends at this position in mm on the train path
    pub position_end: u64,
    /// The color of the aspect
    /// (Bits 24-31 are alpha, 16-23 are red, 8-15 are green, 0-7 are blue)
    pub color: i32,
    /// Whether the signal is blinking
    pub blinking: bool,
    /// The labels of the new aspect
    pub aspect_label: String,
}

#[derive(Debug, Serialize)]
pub struct TrainSimulation<'a> {
    pub signal_critical_positions: &'a Vec<SignalCriticalPosition>,
    pub zone_updates: &'a Vec<ZoneUpdate>,
    pub simulation_end_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SignalUpdatesResponse {
    pub signal_updates: Vec<Vec<SignalUpdate>>,
}

impl AsCoreRequest<Json<SignalUpdatesResponse>> for SignalUpdatesRequest<'_> {
    const URL_PATH: &'static str = "/signal_projection";

    fn worker_id(&self) -> Option<String> {
        Some(self.infra.to_string())
    }
}
