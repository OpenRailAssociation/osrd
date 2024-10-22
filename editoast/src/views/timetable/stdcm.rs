use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use chrono::Utc;
use chrono::{DateTime, Duration, NaiveDateTime, TimeZone};
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::primitives::PositiveDuration;
use editoast_schemas::rolling_stock::TowedRollingStock;
use editoast_schemas::train_schedule::PathItemLocation;
use editoast_schemas::train_schedule::ReceptionSignal;
use editoast_schemas::train_schedule::{Comfort, Margins, PathItem};
use editoast_schemas::train_schedule::{MarginValue, ScheduleItem};
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::max;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::SelectionSettings;
use crate::core::conflict_detection::ConflictDetectionRequest;
use crate::core::conflict_detection::TrainRequirements;
use crate::core::conflict_detection::WorkSchedulesRequest;
use crate::core::pathfinding::InvalidPathItem;
use crate::core::pathfinding::PathfindingInputError;
use crate::core::simulation::PhysicsConsist;
use crate::core::simulation::PhysicsRollingStock;
use crate::core::simulation::{RoutingRequirement, SimulationResponse, SpacingRequirement};
use crate::core::stdcm::STDCMPathItem;
use crate::core::stdcm::STDCMRequest;
use crate::core::stdcm::STDCMResponse;
use crate::core::stdcm::STDCMStepTimingData;
use crate::core::stdcm::UndirectedTrackRange;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::models::temporary_speed_limits::TemporarySpeedLimit;
use crate::models::timetable::TimetableWithTrains;
use crate::models::towed_rolling_stock::TowedRollingStockModel;
use crate::models::train_schedule::TrainSchedule;
use crate::models::work_schedules::WorkSchedule;
use crate::models::RollingStockModel;
use crate::models::{Infra, List};
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::train_schedule::train_simulation;
use crate::views::train_schedule::train_simulation_batch;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use crate::Retrieve;
use crate::RetrieveBatch;
use crate::ValkeyClient;

crate::routes! {
    "/stdcm" => stdcm,
}

editoast_common::schemas! {
    STDCMRequestPayload,
    PathfindingItem,
    StepTimingData,
}

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "stdcm_v2")]
enum STDCMError {
    #[error("Infrastrcture {infra_id} does not exist")]
    InfraNotFound { infra_id: i64 },
    #[error("Timetable {timetable_id} does not exist")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Rolling stock {rolling_stock_id} does not exist")]
    RollingStockNotFound { rolling_stock_id: i64 },
    #[error("Towed rolling stock {towed_rolling_stock_id} does not exist")]
    TowedRollingStockNotFound { towed_rolling_stock_id: i64 },
    #[error("Path items are invalid")]
    InvalidPathItems { items: Vec<InvalidPathItem> },
}

/// An STDCM request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct STDCMRequestPayload {
    /// Deprecated, first step arrival time should be used instead
    start_time: Option<DateTime<Utc>>,
    steps: Vec<PathfindingItem>,
    rolling_stock_id: i64,
    towed_rolling_stock_id: Option<i64>,
    electrical_profile_set_id: Option<i64>,
    work_schedule_group_id: Option<i64>,
    temporary_speed_limit_group_id: Option<i64>,
    comfort: Comfort,
    /// By how long we can shift the departure time in milliseconds
    /// Deprecated, first step data should be used instead
    maximum_departure_delay: Option<u64>,
    /// Specifies how long the total run time can be in milliseconds
    /// Deprecated, first step data should be used instead
    maximum_run_time: Option<u64>,
    /// Train categories for speed limits
    // TODO: rename the field and its description
    speed_limit_tags: Option<String>,
    /// Margin before the train passage in seconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many milliseconds before its passage.
    #[serde(default)]
    time_gap_before: u64,
    /// Margin after the train passage in milliseconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many milliseconds after its passage.
    #[serde(default)]
    time_gap_after: u64,
    /// Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km`
    #[serde(default)]
    #[schema(value_type = Option<String>, example = json!(["5%", "2min/100km"]))]
    margin: Option<MarginValue>,
    /// Total mass of the consist in kg
    total_mass: Option<f64>,
    /// Total length of the consist in meters
    total_length: Option<f64>,
    /// Maximum speed of the consist in km/h
    max_speed: Option<f64>,
}

impl STDCMRequestPayload {
    pub fn simulation_parameters(
        &self,
        towed_rolling_stock: Option<TowedRollingStock>,
    ) -> PhysicsConsist {
        PhysicsConsist {
            total_mass: self.total_mass,
            total_length: self.total_length,
            max_speed: self.max_speed,
            towed_rolling_stock,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
struct PathfindingItem {
    /// The stop duration in milliseconds, None if the train does not stop.
    duration: Option<u64>,
    /// The associated location
    location: PathItemLocation,
    /// Time at which the train should arrive at the location, if specified
    timing_data: Option<StepTimingData>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
struct StepTimingData {
    /// Time at which the train should arrive at the location
    arrival_time: DateTime<Utc>,
    /// The train may arrive up to this duration before the expected arrival time
    arrival_time_tolerance_before: u64,
    /// The train may arrive up to this duration after the expected arrival time
    arrival_time_tolerance_after: u64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
struct InfraIdQueryParam {
    infra: i64,
}

/// This function computes a STDCM and returns the result.
/// It first checks user authorization, then retrieves timetable, infrastructure,
/// train schedules, and rolling stock data, and runs train simulations.
/// The result contains the simulation output based on the train schedules
/// and infrastructure provided.
///
/// If the simulation fails, the function uses a virtual train to detect conflicts
/// with existing train schedules. It then returns both the conflict information
/// and the pathfinding result from the virtual train's simulation.
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    request_body = inline(STDCMRequestPayload),
    params(("infra" = i64, Query, description = "The infra id"),
        ("id" = i64, Path, description = "timetable_id"),
    ),
    responses(
        (status = 201, body = inline(STDCMResponse), description = "The simulation result"),
    )
)]
async fn stdcm(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(id): Path<i64>,
    Query(query): Query<InfraIdQueryParam>,
    Json(stdcm_request): Json<STDCMRequestPayload>,
) -> Result<Json<STDCMResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let conn = &mut db_pool.get().await?;

    let valkey_client = app_state.valkey.clone();
    let core_client = app_state.core_client.clone();
    let timetable_id = id;
    let infra_id = query.infra;

    // 1. Retrieve Timetable / Infra / Trains / Simulation / Rolling Stock
    let timetable_trains = TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || {
        STDCMError::TimetableNotFound { timetable_id }
    })
    .await?;

    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || STDCMError::InfraNotFound { infra_id }).await?;

    let (train_schedules, _): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(conn, timetable_trains.train_ids.clone()).await?;

    let rolling_stock =
        RollingStockModel::retrieve_or_fail(conn, stdcm_request.rolling_stock_id, || {
            STDCMError::RollingStockNotFound {
                rolling_stock_id: stdcm_request.rolling_stock_id,
            }
        })
        .await?;

    let towed_rolling_stock =
        if let Some(towed_rolling_stock_id) = stdcm_request.towed_rolling_stock_id {
            let towed_rolling_stock =
                TowedRollingStockModel::retrieve_or_fail(conn, towed_rolling_stock_id, || {
                    STDCMError::TowedRollingStockNotFound {
                        towed_rolling_stock_id,
                    }
                })
                .await?;
            Some(towed_rolling_stock)
        } else {
            None
        };

    let physics_consist =
        stdcm_request.simulation_parameters(towed_rolling_stock.map(|trs| trs.into()));

    let simulations = train_simulation_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        &train_schedules,
        &infra,
        stdcm_request.electrical_profile_set_id,
    )
    .await?;

    // 2. Compute the earliest start time, maximum running time and maximum departure delay
    // Simulation time without stop duration
    let (
        simulation_run_time,
        virtual_train_schedule,
        virtual_train_sim_result,
        virtual_train_pathfinding_result,
    ) = simulate_train_run(
        db_pool.clone(),
        valkey_client.clone(),
        core_client.clone(),
        &stdcm_request,
        &infra,
        &rolling_stock,
        timetable_id,
    )
    .await?;
    let simulation_run_time = match simulation_run_time {
        SimulationTimeResult::SimulationTime { value } => value,
        SimulationTimeResult::Error { error } => {
            return Ok(Json(STDCMResponse::PreprocessingSimulationError {
                error: *error,
            }))
        }
    };

    let earliest_step_tolerance_window = get_earliest_step_tolerance_window(&stdcm_request);
    let maximum_departure_delay = get_maximum_departure_delay(
        &stdcm_request,
        simulation_run_time,
        earliest_step_tolerance_window,
    );
    // Maximum duration between train departure and arrival, including all stops
    let maximum_run_time = stdcm_request
        .maximum_run_time
        .unwrap_or(2 * simulation_run_time + get_total_stop_time(&stdcm_request));

    let earliest_departure_time = get_earliest_departure_time(&stdcm_request, maximum_run_time);
    let latest_simulation_end = earliest_departure_time
        + Duration::milliseconds((maximum_run_time + earliest_step_tolerance_window) as i64);

    // 3. Get scheduled train requirements
    let trains_requirements = build_train_requirements(
        train_schedules.clone(),
        simulations.clone(),
        earliest_departure_time,
        latest_simulation_end,
    );

    // 4. Parse stdcm path items
    let path_items = parse_stdcm_steps(conn, &stdcm_request, &infra).await?;

    // 5. Get applicable temporary speed limits
    let temporary_speed_limits = match stdcm_request.temporary_speed_limit_group_id {
        Some(group_id) => {
            build_temporary_speed_limits(
                conn,
                earliest_departure_time,
                latest_simulation_end,
                group_id,
            )
            .await?
        }
        None => vec![],
    };

    // 6. Retrieve work schedules
    let work_schedules = match stdcm_request.work_schedule_group_id {
        Some(work_schedule_group_id) => {
            let selection_setting = SelectionSettings::new()
                .filter(move || WorkSchedule::WORK_SCHEDULE_GROUP_ID.eq(work_schedule_group_id));
            WorkSchedule::list(conn, selection_setting).await?
        }
        None => vec![],
    };

    // 7. Build STDCM request
    let stdcm_request = STDCMRequest {
        infra: infra.id,
        expected_version: infra.version.clone(),
        rolling_stock_loading_gauge: rolling_stock.loading_gauge,
        rolling_stock_supported_signaling_systems: rolling_stock
            .supported_signaling_systems
            .clone(),
        comfort: stdcm_request.comfort,
        path_items,
        start_time: earliest_departure_time,
        trains_requirements: trains_requirements.clone(),
        maximum_departure_delay,
        maximum_run_time,
        speed_limit_tag: stdcm_request.speed_limit_tags,
        time_gap_before: stdcm_request.time_gap_before,
        time_gap_after: stdcm_request.time_gap_after,
        margin: stdcm_request.margin,
        time_step: Some(2000),
        work_schedules: filter_stdcm_work_schedules(
            &work_schedules,
            earliest_departure_time,
            maximum_run_time,
        ),
        temporary_speed_limits,
        rolling_stock: PhysicsRollingStock::new(rolling_stock.into(), physics_consist),
    };

    let stdcm_response = stdcm_request.fetch(core_client.as_ref()).await?;

    // 8. Handle PathNotFound response of STDCM
    if let STDCMResponse::PathNotFound = stdcm_response {
        let stdcm_response = handle_path_not_found(
            virtual_train_schedule,
            train_schedules,
            simulations,
            virtual_train_sim_result,
            virtual_train_pathfinding_result,
            earliest_departure_time,
            maximum_run_time,
            latest_simulation_end,
            &work_schedules,
            infra_id,
            infra.version,
            core_client,
        )
        .await?;

        return Ok(Json(stdcm_response));
    }

    Ok(Json(stdcm_response))
}

#[allow(clippy::too_many_arguments)]
async fn handle_path_not_found(
    virtual_train_schedule: TrainSchedule,
    train_schedules: Vec<TrainSchedule>,
    simulations: Vec<(SimulationResponse, PathfindingResult)>,
    virtual_train_sim_result: SimulationResponse,
    virtual_train_pathfinding_result: PathfindingResult,
    earliest_departure_time: DateTime<Utc>,
    maximum_run_time: u64,
    latest_simulation_end: DateTime<Utc>,
    work_schedules: &[WorkSchedule],
    infra_id: i64,
    infra_version: String,
    core_client: Arc<CoreClient>,
) -> Result<STDCMResponse> {
    let virtual_train_id = virtual_train_schedule.id;

    // Combine the original train schedules with the virtual train schedule.
    let train_schedules = [train_schedules, vec![virtual_train_schedule]].concat();

    // Combine the original simulations with the virtual train's simulation results.
    let simulations = [
        simulations,
        vec![(
            virtual_train_sim_result,
            virtual_train_pathfinding_result.clone(),
        )],
    ]
    .concat();

    // Build train requirements based on the combined train schedules and simulations
    // This prepares the data structure required for conflict detection.
    let trains_requirements = build_train_requirements(
        train_schedules,
        simulations,
        earliest_departure_time,
        latest_simulation_end,
    );

    // Filter the provided work schedules to find those that conflict with the given parameters
    // This identifies any work schedules that may overlap with the earliest departure time and maximum run time.
    let conflict_work_schedules =
        filter_conflict_work_schedules(work_schedules, earliest_departure_time, maximum_run_time);

    // Prepare the conflict detection request.
    let conflict_detection_request = ConflictDetectionRequest {
        infra: infra_id,
        expected_version: infra_version,
        trains_requirements,
        work_schedules: conflict_work_schedules,
    };

    // Send the conflict detection request and await the response.
    let conflict_detection_response = conflict_detection_request.fetch(&core_client).await?;

    // Filter the conflicts to find those specifically related to the virtual train.
    let conflicts: Vec<_> = conflict_detection_response
        .conflicts
        .into_iter()
        .filter(|conflict| conflict.train_ids.contains(&virtual_train_id))
        .map(|mut conflict| {
            conflict.train_ids.retain(|id| id != &virtual_train_id);
            conflict
        })
        .collect();

    // Return the conflicts found along with the pathfinding result for the virtual train.
    Ok(STDCMResponse::Conflicts {
        pathfinding_result: virtual_train_pathfinding_result,
        conflicts,
    })
}

/// Build the list of scheduled train requirements, only including requirements
/// that overlap with the possible simulation times.
fn build_train_requirements(
    train_schedules: Vec<TrainSchedule>,
    simulations: Vec<(SimulationResponse, PathfindingResult)>,
    departure_time: DateTime<Utc>,
    latest_simulation_end: DateTime<Utc>,
) -> HashMap<i64, TrainRequirements> {
    let mut trains_requirements = HashMap::new();
    for (train, (sim, _)) in train_schedules.iter().zip(simulations) {
        let final_output = match sim {
            SimulationResponse::Success { final_output, .. } => final_output,
            _ => continue,
        };

        // First check that the train overlaps with the simulation range
        let start_time = train.start_time;
        let train_duration_ms = *final_output.report_train.times.last().unwrap_or(&0);
        if !is_resource_in_range(
            departure_time,
            latest_simulation_end,
            start_time,
            0,
            train_duration_ms,
        ) {
            continue;
        }

        let spacing_requirements: Vec<SpacingRequirement> = final_output
            .spacing_requirements
            .into_iter()
            .filter(|req| {
                is_resource_in_range(
                    departure_time,
                    latest_simulation_end,
                    start_time,
                    req.begin_time,
                    req.end_time,
                )
            })
            .collect();
        let routing_requirements: Vec<RoutingRequirement> = final_output
            .routing_requirements
            .into_iter()
            .filter(|req| {
                is_resource_in_range(
                    departure_time,
                    latest_simulation_end,
                    start_time,
                    req.begin_time,
                    req.zones
                        .iter()
                        .map(|zone_req| zone_req.end_time)
                        .max()
                        .unwrap_or(req.begin_time),
                )
            })
            .collect();
        trains_requirements.insert(
            train.id,
            TrainRequirements {
                start_time,
                spacing_requirements,
                routing_requirements,
            },
        );
    }
    trains_requirements
}

/// Returns true if the resource use is at least partially in the simulation time range
fn is_resource_in_range(
    earliest_sim_time: DateTime<Utc>,
    latest_sim_time: DateTime<Utc>,
    train_start_time: DateTime<Utc>,
    resource_start_time: u64,
    resource_end_time: u64,
) -> bool {
    let abs_resource_start_time =
        train_start_time + Duration::milliseconds(resource_start_time as i64);
    let abs_resource_end_time = train_start_time + Duration::milliseconds(resource_end_time as i64);
    abs_resource_start_time <= latest_sim_time && abs_resource_end_time >= earliest_sim_time
}

// Returns the maximum departure delay for the train.
fn get_maximum_departure_delay(
    data: &STDCMRequestPayload,
    simulation_run_time: u64,
    earliest_step_tolerance_window: u64,
) -> u64 {
    data.maximum_departure_delay
        .unwrap_or(simulation_run_time + earliest_step_tolerance_window)
}

/// Returns the earliest time at which the train may start
fn get_earliest_departure_time(data: &STDCMRequestPayload, maximum_run_time: u64) -> DateTime<Utc> {
    // Prioritize: start time, or first step time, or (first specified time - max run time)
    data.start_time.unwrap_or(
        data.steps
            .first()
            .and_then(|step| step.timing_data.clone())
            .and_then(|data| {
                Option::from(
                    data.arrival_time
                        - Duration::milliseconds(data.arrival_time_tolerance_before as i64),
                )
            })
            .unwrap_or(
                get_earliest_step_time(data) - Duration::milliseconds(maximum_run_time as i64),
            ),
    )
}

/// Returns the earliest time that has been set on any step
fn get_earliest_step_time(data: &STDCMRequestPayload) -> DateTime<Utc> {
    // Get the earliest time that has been specified for any step
    data.start_time
        .or_else(|| {
            data.steps
                .iter()
                .flat_map(|step| step.timing_data.iter())
                .map(|data| {
                    data.arrival_time
                        - Duration::milliseconds(data.arrival_time_tolerance_before as i64)
                })
                .next()
        })
        .expect("No time specified for stdcm request")
}

/// Returns the earliest tolerance window that has been set on any step
fn get_earliest_step_tolerance_window(data: &STDCMRequestPayload) -> u64 {
    // Get the earliest time window that has been specified for any step, if maximum_run_time is not none
    data.steps
        .iter()
        .flat_map(|step| step.timing_data.iter())
        .map(|data| data.arrival_time_tolerance_before + data.arrival_time_tolerance_after)
        .next()
        .unwrap_or(0)
}

/// Returns a `Result` containing:
/// * `SimulationTimeResult` - The result of the simulation time calculation.
/// * `TrainSchedule` - The generated train schedule based on the provided data.
/// * `SimulationResponse` - Simulation response.
/// * `PathfindingResult` - Pathfinding result.
async fn simulate_train_run(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_client: Arc<ValkeyClient>,
    core_client: Arc<CoreClient>,
    data: &STDCMRequestPayload,
    infra: &Infra,
    rolling_stock: &RollingStockModel,
    timetable_id: i64,
) -> Result<(
    SimulationTimeResult,
    TrainSchedule,
    SimulationResponse,
    PathfindingResult,
)> {
    // Doesn't matter for now, but eventually it will affect tmp speed limits
    let approx_start_time = get_earliest_step_time(data);

    let path = convert_steps(&data.steps);
    let last_step = path.last().expect("empty step list");

    let train_schedule = TrainSchedule {
        id: 0,
        train_name: "".to_string(),
        labels: vec![],
        rolling_stock_name: rolling_stock.name.clone(),
        timetable_id,
        start_time: approx_start_time,
        schedule: vec![ScheduleItem {
            // Make the train stop at the end
            at: last_step.id.clone(),
            arrival: None,
            stop_for: Some(PositiveDuration::try_from(Duration::zero()).unwrap()),
            reception_signal: ReceptionSignal::Open,
            locked: false,
        }],
        margins: build_single_margin(data.margin),
        initial_speed: 0.0,
        comfort: data.comfort,
        path,
        constraint_distribution: Default::default(),
        speed_limit_tag: data.speed_limit_tags.clone(),
        power_restrictions: vec![],
        options: Default::default(),
    };

    let (sim_result, pathfinding_result) = train_simulation(
        &mut db_pool.get().await?,
        valkey_client,
        core_client,
        train_schedule.clone(),
        infra,
        None,
    )
    .await?;

    let simulation_run_time = match sim_result.clone() {
        SimulationResponse::Success { provisional, .. } => SimulationTimeResult::SimulationTime {
            value: *provisional.times.last().expect("empty simulation result"),
        },
        err => SimulationTimeResult::Error {
            error: Box::from(err),
        },
    };
    Ok((
        simulation_run_time,
        train_schedule,
        sim_result,
        pathfinding_result,
    ))
}

/// Returns the request's total stop time
fn get_total_stop_time(data: &STDCMRequestPayload) -> u64 {
    data.steps
        .iter()
        .map(|step: &PathfindingItem| step.duration.unwrap_or_default())
        .sum()
}

/// Convert the list of pathfinding items into a list of path item
fn convert_steps(steps: &[PathfindingItem]) -> Vec<PathItem> {
    steps
        .iter()
        .map(|step| PathItem {
            id: Default::default(),
            deleted: false,
            location: step.location.clone(),
        })
        .collect()
}

/// Build a margins object with one margin value covering the entire range
fn build_single_margin(margin: Option<MarginValue>) -> Margins {
    match margin {
        None => Margins {
            boundaries: vec![],
            values: vec![],
        },
        Some(m) => Margins {
            boundaries: vec![],
            values: vec![m],
        },
    }
}

fn filter_core_work_schedule(
    ws: &WorkSchedule,
    start_time: DateTime<Utc>,
) -> crate::core::stdcm::WorkSchedule {
    crate::core::stdcm::WorkSchedule {
        start_time: elapsed_since_time_ms(&ws.start_date_time, &start_time),
        end_time: elapsed_since_time_ms(&ws.end_date_time, &start_time),
        track_ranges: ws
            .track_ranges
            .iter()
            .map(|track| UndirectedTrackRange {
                track_section: track.track.to_string(),
                begin: (track.begin * 1000.0) as u64,
                end: (track.end * 1000.0) as u64,
            })
            .collect(),
    }
}

fn filter_stdcm_work_schedules(
    work_schedules: &[WorkSchedule],
    start_time: DateTime<Utc>,
    maximum_run_time: u64,
) -> Vec<crate::core::stdcm::WorkSchedule> {
    work_schedules
        .iter()
        .map(|ws| filter_core_work_schedule(ws, start_time))
        .filter(|ws| ws.end_time > 0 && ws.start_time < maximum_run_time)
        .collect()
}

fn filter_conflict_work_schedules(
    work_schedules: &[WorkSchedule],
    start_time: DateTime<Utc>,
    maximum_run_time: u64,
) -> Option<WorkSchedulesRequest> {
    if work_schedules.is_empty() {
        return None;
    }

    let work_schedule_requirements = work_schedules
        .iter()
        .map(|ws| (ws.id, filter_core_work_schedule(ws, start_time)))
        .filter(|(_, ws)| ws.end_time > 0 && ws.start_time < maximum_run_time)
        .collect();

    Some(WorkSchedulesRequest {
        start_time,
        work_schedule_requirements,
    })
}

/// Return the list of speed limits that are active at any point in a given time range
async fn build_temporary_speed_limits(
    conn: &mut DbConnection,
    start_date_time: DateTime<Utc>,
    end_date_time: DateTime<Utc>,
    temporary_speed_limit_group_id: i64,
) -> Result<Vec<crate::core::stdcm::TemporarySpeedLimit>> {
    if end_date_time <= start_date_time {
        return Ok(Vec::new());
    }
    let selection_settings: SelectionSettings<TemporarySpeedLimit> = SelectionSettings::new()
        .filter(move || {
            TemporarySpeedLimit::TEMPORARY_SPEED_LIMIT_GROUP_ID.eq(temporary_speed_limit_group_id)
        });
    let applicable_speed_limits = TemporarySpeedLimit::list(conn, selection_settings)
        .await?
        .into_iter()
        .filter(|speed_limit| {
            !(end_date_time <= speed_limit.start_date_time.and_utc()
                || speed_limit.end_date_time.and_utc() <= start_date_time)
        })
        .map_into()
        .collect();
    Ok(applicable_speed_limits)
}

fn elapsed_since_time_ms(time: &NaiveDateTime, zero: &DateTime<Utc>) -> u64 {
    max(0, (Utc.from_utc_datetime(time) - zero).num_milliseconds()) as u64
}

/// Create steps from track_map and waypoints
async fn parse_stdcm_steps(
    conn: &mut DbConnection,
    data: &STDCMRequestPayload,
    infra: &Infra,
) -> Result<Vec<STDCMPathItem>> {
    let locations: Vec<_> = data.steps.iter().map(|item| &item.location).collect();

    let path_item_cache = PathItemCache::load(conn, infra.id, &locations).await?;
    let track_offsets = path_item_cache
        .extract_location_from_path_items(&locations)
        .map_err(|path_res| match path_res {
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems { items },
            )) => STDCMError::InvalidPathItems { items },
            _ => panic!("Unexpected pathfinding result"),
        })?;

    Ok(track_offsets
        .iter()
        .zip(&data.steps)
        .map(|(track_offset, path_item)| STDCMPathItem {
            stop_duration: path_item.duration,
            locations: track_offset.to_vec(),
            step_timing_data: path_item.timing_data.as_ref().map(|timing_data| {
                STDCMStepTimingData {
                    arrival_time: timing_data.arrival_time,
                    arrival_time_tolerance_before: timing_data.arrival_time_tolerance_before,
                    arrival_time_tolerance_after: timing_data.arrival_time_tolerance_after,
                }
            }),
        })
        .collect())
}

#[derive(Debug)]
enum SimulationTimeResult {
    SimulationTime { value: u64 },
    Error { error: Box<SimulationResponse> },
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use chrono::DateTime;
    use editoast_models::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::str::FromStr;
    use uuid::Uuid;

    use crate::core::conflict_detection::Conflict;
    use crate::core::conflict_detection::ConflictType;
    use crate::core::mocking::MockingClient;
    use crate::core::pathfinding::PathfindingResultSuccess;
    use crate::core::simulation::CompleteReportTrain;
    use crate::core::simulation::ElectricalProfiles;
    use crate::core::simulation::ReportTrain;
    use crate::core::simulation::SimulationResponse;
    use crate::core::simulation::SpeedLimitProperties;
    use crate::core::stdcm::STDCMResponse;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::views::rolling_stock::tests::fast_rolling_stock_form;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::stdcm::PathfindingResult;

    use super::*;

    #[test]
    fn simulation_with_towed_rolling_stock_parameters() {
        let mut rolling_stock = create_simple_rolling_stock();
        rolling_stock.mass = 100000.0;
        rolling_stock.length = 20.0;
        rolling_stock.inertia_coefficient = 1.10; // m/s²
        rolling_stock.comfort_acceleration = 0.1;
        rolling_stock.startup_acceleration = 0.04; // m/s²
        rolling_stock.rolling_resistance =
            RollingResistance::new("davis".to_string(), 1.0, 0.01, 0.0005);

        let towed_rolling_stock = create_towed_rolling_stock();

        let total_mass = 200000.0;

        let simulation_parameters = PhysicsConsist {
            total_length: None,
            max_speed: None,
            total_mass: Some(total_mass),
            towed_rolling_stock: Some(towed_rolling_stock.clone()),
        };

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock.clone(), simulation_parameters);

        assert_eq!(physics_rolling_stock.mass, total_mass as u64);

        assert_eq!(physics_rolling_stock.inertia_coefficient, 1.075_f64);

        assert_eq!(
            physics_rolling_stock.rolling_resistance,
            RollingResistance::new("davis".to_string(), 2000.0, 72.0, 9.072000000000001)
        );
    }

    #[test]
    fn simulation_with_parameters() {
        let rolling_stock = create_simple_rolling_stock();

        let simulation_parameters = PhysicsConsist {
            total_mass: Some(123.0),
            total_length: Some(455.0),
            max_speed: Some(10.0), // m/s
            towed_rolling_stock: None,
        };

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock, simulation_parameters);

        assert_eq!(physics_rolling_stock.mass, 123_u64);
        assert_eq!(physics_rolling_stock.length, 455000_u64); // It should be converted in mm
        assert_eq!(physics_rolling_stock.max_speed, 10_f64); // It should be in m/s
    }

    #[test]
    fn simulation_without_parameters() {
        let rolling_stock = create_simple_rolling_stock();
        let simulation_parameters = PhysicsConsist::default();

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock, simulation_parameters);

        assert_eq!(physics_rolling_stock.mass, 15000_u64);
        assert_eq!(physics_rolling_stock.length, 140000_u64); // It should be converted in mm
        assert_eq!(physics_rolling_stock.max_speed, 20_f64);
    }

    #[test]
    fn new_physics_rolling_stock_keeps_the_smallest_available_comfort_acceleration() {
        let mut rolling_stock = create_simple_rolling_stock();
        let mut towed_rolling_stock = create_towed_rolling_stock();
        rolling_stock.comfort_acceleration = 0.2;
        towed_rolling_stock.comfort_acceleration = 0.1;

        let mut simulation_parameters = PhysicsConsist {
            max_speed: None,
            total_length: None,
            total_mass: None,
            towed_rolling_stock: Some(towed_rolling_stock.clone()),
        };

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock.clone(), simulation_parameters.clone());

        assert_eq!(physics_rolling_stock.comfort_acceleration, 0.1);

        rolling_stock.comfort_acceleration = 0.2;
        towed_rolling_stock.comfort_acceleration = 0.67;
        simulation_parameters.towed_rolling_stock = Some(towed_rolling_stock);

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock, simulation_parameters);

        assert_eq!(physics_rolling_stock.comfort_acceleration, 0.2);
    }

    #[test]
    fn new_physics_rolling_stock_keeps_the_bigest_available_startup_acceleration() {
        let mut rolling_stock = create_simple_rolling_stock();
        let mut towed_rolling_stock = create_towed_rolling_stock();
        rolling_stock.startup_acceleration = 0.3;
        towed_rolling_stock.startup_acceleration = 0.45;

        let simulation_parameters = PhysicsConsist {
            max_speed: None,
            total_length: None,
            total_mass: None,
            towed_rolling_stock: Some(towed_rolling_stock.clone()),
        };

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock.clone(), simulation_parameters.clone());

        assert_eq!(physics_rolling_stock.startup_acceleration, 0.45);

        towed_rolling_stock.startup_acceleration = 0.4;
        rolling_stock.startup_acceleration = 0.88;

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock, simulation_parameters);

        assert_eq!(physics_rolling_stock.startup_acceleration, 0.88);
    }

    #[test]
    fn new_physics_rolling_stock_keeps_the_smallest_available_max_speed() {
        let rolling_stock = create_simple_rolling_stock();

        let simulation_parameters = PhysicsConsist {
            total_mass: None,
            total_length: None,
            max_speed: Some(30.0), // m/s
            towed_rolling_stock: None,
        };

        let physics_rolling_stock: PhysicsRollingStock =
            PhysicsRollingStock::new(rolling_stock, simulation_parameters);

        assert_eq!(physics_rolling_stock.max_speed, 20_f64);
    }

    fn pathfinding_result_success() -> PathfindingResult {
        PathfindingResult::Success(PathfindingResultSuccess {
            blocks: vec![],
            routes: vec![],
            track_section_ranges: vec![],
            length: 0,
            path_item_positions: vec![0, 10],
        })
    }

    fn simulation_response() -> SimulationResponse {
        SimulationResponse::Success {
            base: ReportTrain {
                positions: vec![],
                times: vec![],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 10],
            },
            provisional: ReportTrain {
                positions: vec![],
                times: vec![0, 10],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 10],
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    positions: vec![],
                    times: vec![],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 10],
                },
                signal_sightings: vec![],
                zone_updates: vec![],
                spacing_requirements: vec![],
                routing_requirements: vec![],
            },
            mrsp: SpeedLimitProperties {
                boundaries: vec![],
                values: vec![],
            },
            electrical_profiles: ElectricalProfiles {
                boundaries: vec![],
                values: vec![],
            },
        }
    }

    fn stdcm_payload(rolling_stock_id: i64) -> serde_json::Value {
        json!({
          "comfort": "STANDARD",
          "margin": "4.5min/100km",
          "rolling_stock_id": rolling_stock_id,
          "speed_limit_tags": "AR120",
          "steps": [
            {
              "duration": 0,
              "location": { "trigram": "WS", "secondary_code": "BV" },
              "timing_data": {
                "arrival_time": "2024-09-17T20:05:00+02:00",
                "arrival_time_tolerance_before": 0,
                "arrival_time_tolerance_after": 0
              }
            },
            { "duration": 0, "location": { "trigram": "MWS", "secondary_code": "BV" } }
          ],
          "time_gap_after": 35000,
          "time_gap_before": 35000
        })
    }

    fn core_mocking_client() -> MockingClient {
        let mut core = MockingClient::new();
        core.stub("/v2/pathfinding/blocks")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(pathfinding_result_success())
            .finish();
        core.stub("/v2/standalone_simulation")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(serde_json::to_value(simulation_response()).unwrap())
            .finish();
        core
    }

    fn conflict_data() -> Conflict {
        Conflict {
            train_ids: vec![0, 1],
            work_schedule_ids: vec![],
            start_time: DateTime::from_str("2024-01-01T00:00:00Z")
                .expect("Failed to parse datetime"),
            end_time: DateTime::from_str("2024-01-02T00:00:00Z").expect("Failed to parse datetime"),
            conflict_type: ConflictType::Spacing,
            requirements: vec![],
        }
    }

    #[rstest]
    async fn stdcm_return_success() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({
                "status": "success",
                "simulation": serde_json::to_value(simulation_response()).unwrap(),
                "path": serde_json::to_value(pathfinding_result_success()).unwrap(),
                "departure_time": "2024-01-02T00:00:00Z"
            }))
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&stdcm_payload(rolling_stock.id));

        let stdcm_response: STDCMResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        if let PathfindingResult::Success(path) = pathfinding_result_success() {
            assert_eq!(
                stdcm_response,
                STDCMResponse::Success {
                    simulation: simulation_response(),
                    path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime")
                }
            );
        }
    }

    #[rstest]
    async fn stdcm_return_conflicts() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({"status": "path_not_found"}))
            .finish();
        core.stub("/v2/conflict_detection")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({"conflicts": [
                serde_json::to_value(conflict_data()).unwrap()
            ]}))
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&stdcm_payload(rolling_stock.id));

        let stdcm_response: STDCMResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let mut conflict = conflict_data();
        conflict.train_ids = vec![1];

        assert_eq!(
            stdcm_response,
            STDCMResponse::Conflicts {
                pathfinding_result: pathfinding_result_success(),
                conflicts: vec![conflict],
            }
        );
    }
}
