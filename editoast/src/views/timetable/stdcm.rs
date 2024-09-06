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
use crate::core::pathfinding::InvalidPathItem;
use crate::core::pathfinding::PathfindingResult;
use crate::core::simulation::{RoutingRequirement, SimulationResponse, SpacingRequirement};
use crate::core::stdcm::STDCMResponse;
use crate::core::stdcm::TemporarySpeedLimit as CoreTemporarySpeedLimit;
use crate::core::stdcm::TrainRequirement;
use crate::core::stdcm::{STDCMPathItem, UndirectedTrackRange, WorkSchedule as CoreWorkSchedule};
use crate::core::stdcm::{STDCMRequest, STDCMStepTimingData};
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::models::temporary_speed_limits::TemporarySpeedLimit;
use crate::models::timetable::TimetableWithTrains;
use crate::models::train_schedule::TrainSchedule;
use crate::models::work_schedules::WorkSchedule;
use crate::models::RollingStockModel;
use crate::models::{Infra, List};
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::train_schedule::train_simulation;
use crate::views::train_schedule::train_simulation_batch;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::AppState;
use crate::RedisClient;
use crate::Retrieve;
use crate::RetrieveBatch;

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

/// Compute a STDCM and return the simulation result
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
    Extension(authorizer): AuthorizerExt,
    Path(id): Path<i64>,
    Query(query): Query<InfraIdQueryParam>,
    Json(stdcm_request): Json<STDCMRequestPayload>,
) -> Result<Json<STDCMResponse>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let conn = &mut db_pool.get().await?;

    let redis_client = app_state.redis.clone();
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

    let (trains, _): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(conn, timetable_trains.train_ids).await?;

    let rolling_stock =
        RollingStockModel::retrieve_or_fail(conn, stdcm_request.rolling_stock_id, || {
            STDCMError::RollingStockNotFound {
                rolling_stock_id: stdcm_request.rolling_stock_id,
            }
        })
        .await?;

    let simulations = train_simulation_batch(
        conn,
        redis_client.clone(),
        core_client.clone(),
        &trains,
        &infra,
        stdcm_request.electrical_profile_set_id,
    )
    .await?;

    // 2. Compute the earliest start time, maximum running time and maximum departure delay
    let simulation_run_time_result = get_simulation_run_time(
        db_pool.clone(),
        redis_client.clone(),
        core_client.clone(),
        &stdcm_request,
        &infra,
        &rolling_stock,
        timetable_id,
    )
    .await?;
    let simulation_run_time = match simulation_run_time_result {
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
    let maximum_run_time_without_tolerance =
        2 * simulation_run_time + get_total_stop_time(&stdcm_request);
    let maximum_run_time = get_maximum_run_time(
        &stdcm_request,
        maximum_run_time_without_tolerance,
        earliest_step_tolerance_window,
    );

    let earliest_departure_time =
        get_earliest_departure_time(&stdcm_request, maximum_run_time_without_tolerance);
    let latest_simulation_end =
        earliest_departure_time + Duration::milliseconds((maximum_run_time) as i64);

    let latest_arrival_time =
        get_latest_arrival_time(&stdcm_request, maximum_run_time_without_tolerance);

    // 3. Get scheduled train requirements
    let trains_requirements = build_train_requirements(
        trains,
        simulations,
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
                latest_arrival_time,
                group_id,
            )
            .await?
        }
        None => vec![],
    };

    // 6. Build STDCM request
    let stdcm_response = STDCMRequest {
        infra: infra.id,
        expected_version: infra.version,
        rolling_stock: rolling_stock.clone().into(),
        rolling_stock_loading_gauge: rolling_stock.loading_gauge,
        rolling_stock_supported_signaling_systems: rolling_stock
            .supported_signaling_systems
            .clone(),
        comfort: stdcm_request.comfort,
        path_items,
        start_time: earliest_departure_time,
        trains_requirements,
        maximum_departure_delay,
        maximum_run_time,
        speed_limit_tag: stdcm_request.speed_limit_tags,
        time_gap_before: stdcm_request.time_gap_before,
        time_gap_after: stdcm_request.time_gap_after,
        margin: stdcm_request.margin,
        time_step: Some(2000),
        work_schedules: match stdcm_request.work_schedule_group_id {
            Some(work_schedule_group_id) => {
                build_work_schedules(
                    conn,
                    earliest_departure_time,
                    maximum_run_time,
                    work_schedule_group_id,
                )
                .await?
            }
            None => vec![],
        },
        temporary_speed_limits,
    }
    .fetch(core_client.as_ref())
    .await?;

    Ok(Json(stdcm_response))
}

/// Build the list of scheduled train requirements, only including requirements
/// that overlap with the possible simulation times.
fn build_train_requirements(
    trains: Vec<TrainSchedule>,
    simulations: Vec<(SimulationResponse, PathfindingResult)>,
    departure_time: DateTime<Utc>,
    latest_simulation_end: DateTime<Utc>,
) -> HashMap<i64, TrainRequirement> {
    let mut trains_requirements = HashMap::new();
    for (train, (sim, _)) in trains.iter().zip(simulations) {
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
            TrainRequirement {
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

// Returns the maximum run time for the simulation.
fn get_maximum_run_time(
    data: &STDCMRequestPayload,
    maximum_run_time_without_tolerance: u64,
    earliest_step_tolerance_window: u64,
) -> u64 {
    data.maximum_run_time
        .unwrap_or(maximum_run_time_without_tolerance + earliest_step_tolerance_window)
}

/// Returns the earliest time at which the train may start
fn get_earliest_departure_time(
    data: &STDCMRequestPayload,
    maximum_run_time_without_tolerance: u64,
) -> DateTime<Utc> {
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
                get_earliest_step_time(data)
                    - Duration::milliseconds(maximum_run_time_without_tolerance as i64),
            ),
    )
}

/// Return the latest time at which the train may arrive, margins included.
fn get_latest_arrival_time(
    data: &STDCMRequestPayload,
    maximum_run_time_without_tolerance: u64,
) -> DateTime<Utc> {
    // Return the maximum time between:
    //   * latest step time + its tolerance after
    //   * start time + maximum start delay + max runtime
    //   * first step time + its tolerance after + max runtime
    let result_from_last_step: Option<DateTime<Utc>> = get_last_step_with_timing(data)
        .and_then(|step| step.timing_data.as_ref())
        .map(|timing| {
            timing.arrival_time + Duration::milliseconds(timing.arrival_time_tolerance_after as i64)
        });
    let result_from_start_time: Option<DateTime<Utc>> = data.start_time.map(|start| {
        start
            + Duration::milliseconds(
                (data.maximum_departure_delay.unwrap_or(0) + maximum_run_time_without_tolerance)
                    as i64,
            )
    });
    let result_from_first_step: Option<DateTime<Utc>> = get_first_step_with_timing(data)
        .and_then(|step| step.timing_data.as_ref())
        .map(|timing| {
            timing.arrival_time
                + Duration::milliseconds(
                    (timing.arrival_time_tolerance_after + maximum_run_time_without_tolerance)
                        as i64,
                )
        });
    [
        result_from_first_step,
        result_from_last_step,
        result_from_start_time,
    ]
    .into_iter()
    .flatten()
    .max()
    .expect("No arrival time specified in the STDCM request.")
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

/// Return last step that has a timing defined.
fn get_last_step_with_timing(data: &STDCMRequestPayload) -> Option<&PathfindingItem> {
    data.steps
        .iter()
        .rev()
        .find(|step| step.timing_data.is_some())
}

/// Return the first step that has a timing defined.
fn get_first_step_with_timing(data: &STDCMRequestPayload) -> Option<&PathfindingItem> {
    data.steps.iter().find(|step| step.timing_data.is_some())
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

/// Computes the simulation run time
/// Returns an enum with either the result or a SimulationResponse if it failed
async fn get_simulation_run_time(
    db_pool: Arc<DbConnectionPoolV2>,
    redis_client: Arc<RedisClient>,
    core_client: Arc<CoreClient>,
    data: &STDCMRequestPayload,
    infra: &Infra,
    rolling_stock: &RollingStockModel,
    timetable_id: i64,
) -> Result<SimulationTimeResult> {
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

    let (sim_result, _) = train_simulation(
        &mut db_pool.get().await?,
        redis_client,
        core_client,
        train_schedule,
        infra,
        None,
    )
    .await?;

    return Ok(match sim_result {
        SimulationResponse::Success { provisional, .. } => SimulationTimeResult::SimulationTime {
            value: *provisional.times.last().expect("empty simulation result"),
        },
        err => SimulationTimeResult::Error {
            error: Box::from(err),
        },
    });
}

/// Returns the request's total stop time
fn get_total_stop_time(data: &STDCMRequestPayload) -> u64 {
    return data
        .steps
        .iter()
        .map(|step: &PathfindingItem| step.duration.unwrap_or_default())
        .sum();
}

/// Convert the list of pathfinding items into a list of path item
fn convert_steps(steps: &[PathfindingItem]) -> Vec<PathItem> {
    return steps
        .iter()
        .map(|step| PathItem {
            id: Default::default(),
            deleted: false,
            location: step.location.clone(),
        })
        .collect();
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

/// Build the list of work schedules for the given time range
async fn build_work_schedules(
    conn: &mut DbConnection,
    time: DateTime<Utc>,
    maximum_run_time: u64,
    work_schedule_group_id: i64,
) -> Result<Vec<CoreWorkSchedule>> {
    let selection_setting: SelectionSettings<WorkSchedule> = SelectionSettings::new()
        .filter(move || WorkSchedule::WORK_SCHEDULE_GROUP_ID.eq(work_schedule_group_id));
    let res = Ok(WorkSchedule::list(conn, selection_setting)
        .await?
        .iter()
        .map(|ws| {
            let schedule = CoreWorkSchedule {
                start_time: elapsed_since_time_ms(&ws.start_date_time, &time),
                end_time: elapsed_since_time_ms(&ws.end_date_time, &time),
                track_ranges: ws
                    .track_ranges
                    .iter()
                    .map(|track| UndirectedTrackRange {
                        track_section: track.track.to_string(),
                        begin: (track.begin * 1000.0) as u64,
                        end: (track.end * 1000.0) as u64,
                    })
                    .collect(),
            };
            schedule
        })
        .filter(|ws| ws.end_time > 0 && ws.start_time < maximum_run_time)
        .collect());
    res
}

/// Return the list of speed limits that are active at any point in a given time range
async fn build_temporary_speed_limits(
    conn: &mut DbConnection,
    start_date_time: DateTime<Utc>,
    end_date_time: DateTime<Utc>,
    temporary_speed_limit_group_id: i64,
) -> Result<Vec<CoreTemporarySpeedLimit>> {
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
            PathfindingResult::InvalidPathItems { items } => STDCMError::InvalidPathItems { items },
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

enum SimulationTimeResult {
    SimulationTime { value: u64 },
    Error { error: Box<SimulationResponse> },
}
