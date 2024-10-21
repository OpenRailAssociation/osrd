use editoast_schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::core::simulation::SignalSighting;
use crate::core::simulation::ZoneUpdate;
use crate::core::{AsCoreRequest, Json};

use super::pathfinding::TrackRange;

#[derive(Debug, Serialize)]
pub struct SignalUpdatesRequest<'a> {
    /// Infrastructure id
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: String,
    /// Path description as track ranges
    pub track_section_ranges: &'a Vec<TrackRange>,
    /// Path description as route ids
    pub routes: &'a Vec<Identifier>,
    /// Path description as block ids
    pub blocks: &'a Vec<Identifier>,
    /// List of signal sightings and zone updates for each train
    pub train_simulations: HashMap<i64, TrainSimulation<'a>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SignalUpdate {
    /// The id of the updated signal
    pub signal_id: String,
    /// The name of the signaling system of the signal
    signaling_system: String,
    /// The aspects start being displayed at this time (number of mseconds since `departure_time`)
    pub time_start: u64,
    /// The aspects stop being displayed at this time (number of seconds since `departure_time`)
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
    pub signal_sightings: &'a Vec<SignalSighting>,
    pub zone_updates: &'a Vec<ZoneUpdate>,
    pub simulation_end_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SignalUpdatesResponse {
    pub signal_updates: HashMap<i64, Vec<SignalUpdate>>,
}

impl<'a> AsCoreRequest<Json<SignalUpdatesResponse>> for SignalUpdatesRequest<'a> {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/signal_projection";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
