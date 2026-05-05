use crate::AsCoreRequest;
use crate::Json;
use crate::WorkerKey;
use crate::path_properties::PathPropertiesResponse;
use crate::simulation::SimulationSuccess;
use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

/// A Core stdcm logged data request
#[derive(Debug, Serialize)]
pub struct StdcmLoggedDataRequest {
    pub trace_id: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SimDebugConflictReport {
    at: DateTime<Utc>,
    time_lost: f64,
    best_remaining_time: f64,
    current_travel_time: f64,
    caused_by: String,
    lat: f64,
    lon: f64,
    #[serde(rename = "lastOPName")]
    last_op_name: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SimDebugFailureReport {
    largest_conflicts: Vec<SimDebugConflictReport>,
    closest_conflicts: Vec<SimDebugConflictReport>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SimDebugTrainZoneRequirement {
    zone_name: String,
    begin_time: f64,
    end_time: f64,
    train_name: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SimDebugZoneLocation {
    name: String,
    from: f64,
    to: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SimDebugEngineeringAllowanceRange {
    from: f64,
    to: f64,
    added_duration: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SimDebugData {
    sim_output: Option<SimulationSuccess>,
    path_properties: PathPropertiesResponse,
    other_requirements: Vec<SimDebugTrainZoneRequirement>,
    departure_time: DateTime<Utc>,
    engineering_allowances_ranges: Vec<SimDebugEngineeringAllowanceRange>,
    zone_locations: Vec<SimDebugZoneLocation>,
    train_times: Vec<f64>,
    train_positions: Vec<f64>,
}

/// A Core stdcm logged data response
#[derive(Serialize, Deserialize, ToSchema)]
pub struct StdcmLoggedDataResponse {
    failure: Option<SimDebugFailureReport>,
    simulation_data: Option<SimDebugData>,
}

impl AsCoreRequest<Json<StdcmLoggedDataResponse>> for StdcmLoggedDataRequest {
    const URL_PATH: &'static str = "/stdcm_logged_data";

    fn worker_key(&self) -> WorkerKey {
        WorkerKey::Infra(0) // We don't have (or need) any infra ID there
    }
}
