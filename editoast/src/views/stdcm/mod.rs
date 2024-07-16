use std::ops::DerefMut;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use derivative::Derivative;
use editoast_derive::EditoastError;
use editoast_schemas::rolling_stock::RollingStockComfortType;
use editoast_schemas::train_schedule::AllowanceValue;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use super::pathfinding::fetch_pathfinding_payload_track_map;
use super::pathfinding::parse_pathfinding_payload_waypoints;
use super::pathfinding::PathResponse;
use super::pathfinding::PathfindingStep;
use super::rolling_stocks::RollingStockKey;
use super::timetable::get_simulated_schedules_from_timetable;
use super::train_schedule::process_simulation_response;
use super::train_schedule::projection::Projection;
use super::train_schedule::simulation_report::create_simulation_report;
use super::train_schedule::simulation_report::SimulationReport;
use crate::core::stdcm::STDCMCoreRequest;
use crate::core::stdcm::STDCMCoreResponse;
use crate::core::stdcm::STDCMCoreStep;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::models::Pathfinding;
use crate::models::PathfindingChangeset;
use crate::models::PathfindingPayload;
use crate::models::SpacingRequirement;
use crate::models::TrainSchedule;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::views::rolling_stocks::retrieve_existing_rolling_stock;
use crate::AppState;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
    "/stdcm" => create,
}

/// An STDCM request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
struct STDCMRequestPayload {
    infra_id: i64,
    timetable_id: i64,
    start_time: Option<f64>,
    end_time: Option<f64>,
    steps: Vec<PathfindingStep>,
    rolling_stock_id: i64,
    comfort: RollingStockComfortType,
    /// By how long we can shift the departure time in seconds
    #[serde(default = "default_maximum_departure_delay")]
    #[schema(default = default_maximum_departure_delay)]
    maximum_departure_delay: f64,
    /// Specifies how long the total run time can be in seconds
    #[serde(default = "default_maximum_run_time")]
    #[schema(default = default_maximum_run_time)]
    maximum_run_time: f64,
    /// Train categories for speed limits
    speed_limit_tags: Option<String>,
    /// Margin before the train passage in seconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many seconds before its passage.
    #[serde(default)]
    margin_before: f64,
    /// Margin after the train passage in seconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many seconds after its passage.
    #[serde(default)]
    margin_after: f64,
    standard_allowance: Option<AllowanceValue>,
}

const TWO_HOURS_IN_SECONDS: f64 = 2.0_f64 * 60.0_f64 * 60.0_f64;
const fn default_maximum_departure_delay() -> f64 {
    TWO_HOURS_IN_SECONDS
}

const TWELVE_HOURS_IN_SECONDS: f64 = 12.0_f64 * 60.0_f64 * 60.0_f64;
const fn default_maximum_run_time() -> f64 {
    TWELVE_HOURS_IN_SECONDS
}

/// The response issued after an STDCM calculation
#[derive(Serialize, Deserialize, Debug, Derivative, ToSchema)]
#[derivative(PartialEq)]
pub(super) struct STDCMResponse {
    /// The path of the train
    pub(super) path: PathResponse,
    /// The "payload" of the path
    pub(super) path_payload: PathfindingPayload,
    /// The simulation report
    pub(super) simulation: SimulationReport,
}

impl STDCMResponse {
    fn new(path: Pathfinding, simulation: SimulationReport) -> Self {
        let path_payload = path.payload.clone().0;
        Self {
            path: path.into(),
            path_payload,
            simulation,
        }
    }
}

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "stdcm")]
#[allow(clippy::enum_variant_names)]
enum StdcmError {
    #[error("Infra {infra_id} does not exist")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

/// Compute a STDCM and return the simulation result
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    request_body = inline(STDCMRequestPayload),
    responses(
        (status = 201, body = inline(STDCMResponse), description = "The simulation result"),
    )
)]
async fn create(
    app_state: State<AppState>,
    data: Json<STDCMRequestPayload>,
) -> Result<impl IntoResponse> {
    let db_pool = app_state.db_pool_v2.clone();
    let core = app_state.core_client.clone();
    let stdcm_response = compute_stdcm(db_pool, core, data).await?;
    Ok((StatusCode::CREATED, Json(stdcm_response)))
}

async fn compute_stdcm(
    db_pool: Arc<DbConnectionPoolV2>,
    core: Arc<CoreClient>,
    data: Json<STDCMRequestPayload>,
) -> Result<STDCMResponse> {
    let core_output = call_core_stdcm(db_pool.clone(), &core, &data).await?;
    let path = create_path_from_core_response(db_pool.clone(), &core_output, &data).await?;
    let simulation =
        create_simulation_from_core_response(db_pool, &core, &data, &core_output, &path).await?;
    Ok(STDCMResponse::new(path, simulation))
}

async fn call_core_stdcm(
    db_pool: Arc<DbConnectionPoolV2>,
    core: &Arc<CoreClient>,
    data: &Json<STDCMRequestPayload>,
) -> Result<STDCMCoreResponse> {
    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), data.infra_id, || {
        StdcmError::InfraNotFound {
            infra_id: data.infra_id,
        }
    })
    .await?;
    let rolling_stock = retrieve_existing_rolling_stock(
        db_pool.get().await?.deref_mut(),
        RollingStockKey::Id(data.rolling_stock_id),
    )
    .await?;
    let steps = parse_stdcm_steps(db_pool.clone(), data, &infra).await?;
    let spacing_requirements = make_spacing_requirements(db_pool, data.timetable_id).await?;
    STDCMCoreRequest {
        infra: infra.id.to_string(),
        expected_version: infra.version,
        rolling_stock,
        comfort: data.comfort.clone(),
        steps,
        spacing_requirements,
        // end_time is not used by backend currently
        // but at least one must be defined
        start_time: data.start_time,
        end_time: match data.start_time {
            Some(_) => None,
            None => data.end_time,
        },
        maximum_departure_delay: Some(data.maximum_departure_delay),
        maximum_run_time: data.maximum_run_time,
        speed_limit_tags: data.speed_limit_tags.clone(),
        margin_before: data.margin_before,
        margin_after: data.margin_after,
        standard_allowance: data.standard_allowance.clone(),
        time_step: Some(2.0),
    }
    .fetch(core)
    .await
}

/// create steps from track_map and waypoints
async fn parse_stdcm_steps(
    db_pool: Arc<DbConnectionPoolV2>,
    data: &Json<STDCMRequestPayload>,
    infra: &Infra,
) -> Result<Vec<STDCMCoreStep>> {
    let steps = data.steps.clone();
    let track_map =
        fetch_pathfinding_payload_track_map(db_pool.get().await?.deref_mut(), infra.id, &steps)
            .await?;
    let waypoints = parse_pathfinding_payload_waypoints(&steps, &track_map);
    Ok(waypoints
        .unwrap()
        .iter()
        .zip(steps.iter())
        .map(|(wp, PathfindingStep { duration, .. })| STDCMCoreStep {
            stop_duration: *duration,
            stop: *duration > 0.,
            waypoints: wp.to_vec(),
        })
        .collect())
}

/// Create route occupancies, adjusted by simulation departure time.
/// uses base_simulation by default, or eco_simulation if given
async fn make_spacing_requirements(
    db_pool: Arc<DbConnectionPoolV2>,
    timetable_id: i64,
) -> Result<Vec<SpacingRequirement>> {
    let (schedules, simulations) =
        get_simulated_schedules_from_timetable(timetable_id, db_pool).await?;

    let res = simulations
        .into_iter()
        .zip(schedules)
        .flat_map(|(simulation, schedule)| {
            let sim = simulation
                .eco_simulation
                .map(|sim| sim.0)
                .unwrap_or(simulation.base_simulation.0);

            sim.spacing_requirements
                .into_iter()
                .map(|req| SpacingRequirement {
                    zone: req.zone,
                    begin_time: req.begin_time + schedule.departure_time,
                    end_time: req.end_time + schedule.departure_time,
                })
                .collect::<Vec<_>>()
        })
        .collect();
    Ok(res)
}

/// Creates a Pathfinding using the same function used with core /pathfinding response
async fn create_path_from_core_response(
    db_pool: Arc<DbConnectionPoolV2>,
    core_output: &STDCMCoreResponse,
    data: &Json<STDCMRequestPayload>,
) -> Result<Pathfinding> {
    use crate::models::Create;
    let core_path_response = core_output.path.clone();
    let steps_duration = data.steps.iter().map(|step| step.duration).collect();
    let infra_id = data.infra_id;

    let track_map = core_path_response
        .fetch_track_map(infra_id, db_pool.get().await?.deref_mut())
        .await?;
    let op_map = core_path_response
        .fetch_op_map(infra_id, db_pool.get().await?.deref_mut())
        .await?;
    let pathfinding_from_response =
        Pathfinding::from_core_response(steps_duration, core_path_response, &track_map, &op_map)?;
    PathfindingChangeset {
        id: None,
        infra_id: Some(infra_id),
        ..pathfinding_from_response.into()
    }
    .create_conn(db_pool.get().await?.deref_mut())
    .await
    .map(|pathfinding_cs| pathfinding_cs.into())
}

/// processes the stdcm simulation and create a simulation report
async fn create_simulation_from_core_response(
    db_pool: Arc<DbConnectionPoolV2>,
    core: &Arc<CoreClient>,
    data: &Json<STDCMRequestPayload>,
    core_output: &STDCMCoreResponse,
    path: &Pathfinding,
) -> Result<SimulationReport> {
    let schedule = TrainSchedule {
        id: None,
        departure_time: core_output.departure_time,
        initial_speed: 0.0,
        comfort: data.comfort.to_string(),
        path_id: path.id,
        rolling_stock_id: data.rolling_stock_id,
        timetable_id: data.timetable_id,
        ..Default::default()
    };
    let projection = Projection::new(&path.payload);
    let simulation_output = process_simulation_response(core_output.simulation.clone())?;
    create_simulation_report(
        data.infra_id,
        schedule,
        &projection,
        &path.payload,
        simulation_output[0].clone(),
        db_pool,
        core,
    )
    .await
}

#[cfg(test)]
mod tests {
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
