use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use chrono::Utc;
use chrono::{DateTime, Duration, NaiveDateTime, TimeZone};
use editoast_derive::EditoastError;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::PathItemLocation;
use editoast_schemas::train_schedule::{Comfort, Margins, PathItem};
use serde::Deserialize;
use serde::Serialize;
use std::cmp::max;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::core::v2::pathfinding::PathfindingResult;
use crate::core::v2::simulation::SimulationResponse;
use crate::core::v2::stdcm::STDCMResponse;
use crate::core::v2::stdcm::TrainRequirement;
use crate::core::v2::stdcm::{STDCMPathItem, STDCMWorkSchedule, UndirectedTrackRange};
use crate::core::v2::stdcm::{STDCMRequest, STDCMStepTimingData};
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::modelsv2::timetable::TimetableWithTrains;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::work_schedules::WorkSchedule;
use crate::modelsv2::RollingStockModel;
use crate::modelsv2::{Infra, List};
use crate::views::v2::path::path_item_cache::PathItemCache;
use crate::views::v2::train_schedule::train_simulation;
use crate::views::v2::train_schedule::train_simulation_batch;
use crate::RedisClient;
use crate::Retrieve;
use crate::RetrieveBatch;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
    "/stdcm" => {
        stdcm,
    },
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
    #[error("Path item {index} is invalid")]
    InvalidPathItem {
        index: usize,
        path_item: PathItemLocation,
    },
}

/// An STDCM request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct STDCMRequestPayload {
    /// Deprecated, first step arrival time should be used instead
    start_time: Option<DateTime<Utc>>,
    steps: Vec<PathfindingItem>,
    rolling_stock_id: i64,
    comfort: Comfort,
    /// By how long we can shift the departure time in milliseconds
    /// Deprecated, first step data should be used instead
    #[serde(default = "default_maximum_departure_delay")]
    #[schema(default = default_maximum_departure_delay)]
    maximum_departure_delay: u64,
    /// Specifies how long the total run time can be in milliseconds
    maximum_run_time: Option<u64>,
    /// Train categories for speed limits
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

const TWO_HOURS_IN_MILLISECONDS: u64 = 2 * 60 * 60 * 60;
const fn default_maximum_departure_delay() -> u64 {
    TWO_HOURS_IN_MILLISECONDS
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
struct InfraIdQueryParam {
    infra: i64,
}

/// Compute a STDCM and return the simulation result
#[utoipa::path(
    tag = "stdcm",
    request_body = inline(STDCMRequestPayload),
    params(("infra" = i64, Query, description = "The infra id"),
        ("id" = i64, Path, description = "timetable_id"),
    ),
    responses(
        (status = 201, body = inline(STDCMResponse), description = "The simulation result"),
    )
)]
#[post("")]
async fn stdcm(
    db_pool: Data<DbConnectionPoolV2>,
    redis_client: Data<RedisClient>,
    core_client: Data<CoreClient>,
    id: Path<i64>,
    query: Query<InfraIdQueryParam>,
    data: Json<STDCMRequestPayload>,
) -> Result<Json<STDCMResponse>> {
    let db_pool = db_pool.into_inner();
    let core_client = core_client.into_inner();
    let timetable_id = id.into_inner();
    let infra_id = query.into_inner().infra;
    let data = data.into_inner();
    let redis_client_inner = redis_client.into_inner();

    // 1. Retrieve Timetable / Infra / Trains / Simulation / Rolling Stock
    let timetable_trains = TimetableWithTrains::retrieve_or_fail(
        db_pool.get().await?.deref_mut(),
        timetable_id,
        || STDCMError::TimetableNotFound { timetable_id },
    )
    .await?;

    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        STDCMError::InfraNotFound { infra_id }
    })
    .await?;

    let (trains, _): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(db_pool.get().await?.deref_mut(), timetable_trains.train_ids)
            .await?;

    let rolling_stock = RollingStockModel::retrieve_or_fail(
        db_pool.get().await?.deref_mut(),
        data.rolling_stock_id,
        || STDCMError::RollingStockNotFound {
            rolling_stock_id: data.rolling_stock_id,
        },
    )
    .await?;

    let simulations = train_simulation_batch(
        db_pool.get().await?.deref_mut(),
        redis_client_inner.clone(),
        core_client.clone(),
        &trains,
        &infra,
    )
    .await?;

    // 2. Build core request
    let mut trains_requirements = HashMap::new();
    for (train, sim) in trains.iter().zip(simulations) {
        let (sim, _) = sim;
        let final_output = match sim {
            SimulationResponse::Success { final_output, .. } => final_output,
            _ => continue,
        };
        trains_requirements.insert(
            train.id,
            TrainRequirement {
                start_time: train.start_time,
                spacing_requirements: final_output.spacing_requirements,
                routing_requirements: final_output.routing_requirements,
            },
        );
    }

    let maximum_run_time_result = get_maximum_run_time(
        db_pool.clone(),
        redis_client_inner.clone(),
        core_client.clone(),
        &data,
        &infra,
        &rolling_stock,
        timetable_id,
    )
    .await?;
    let maximum_run_time = match maximum_run_time_result {
        MaxRunningTimeResult::MaxRunningTime { value } => value,
        MaxRunningTimeResult::Error { error } => {
            return Ok(Json(STDCMResponse::PreprocessingSimulationError {
                error: *error,
            }))
        }
    };

    let departure_time = get_earliest_departure_time(&data, maximum_run_time);

    // 3. Parse stdcm path items
    let path_items = parse_stdcm_steps(db_pool.get().await?.deref_mut(), &data, &infra).await?;

    // 4. Build STDCM request
    let stdcm_response = STDCMRequest {
        infra: infra.id,
        expected_version: infra.version,
        rolling_stock: rolling_stock.clone().into(),
        rolling_stock_loading_gauge: rolling_stock.loading_gauge,
        rolling_stock_supported_signaling_systems: rolling_stock
            .supported_signaling_systems
            .clone(),
        comfort: data.comfort,
        path_items,
        start_time: departure_time,
        trains_requirements,
        maximum_departure_delay: Some(data.maximum_departure_delay),
        maximum_run_time,
        speed_limit_tag: data.speed_limit_tags,
        time_gap_before: data.time_gap_before,
        time_gap_after: data.time_gap_after,
        margin: data.margin,
        time_step: Some(2000),
        work_schedules: build_work_schedules(
            db_pool.get().await?.deref_mut(),
            departure_time,
            data.maximum_departure_delay,
            maximum_run_time,
        )
        .await?,
    }
    .fetch(core_client.as_ref())
    .await?;

    Ok(Json(stdcm_response))
}

/// Returns the earliest time at which the train may start
fn get_earliest_departure_time(data: &STDCMRequestPayload, maximum_run_time: u64) -> DateTime<Utc> {
    // Prioritize: start time, or first step time, or (first specified time - max run time)
    data.start_time.unwrap_or(
        data.steps
            .first()
            .and_then(|step| step.timing_data.clone())
            .and_then(|data| Option::from(data.arrival_time))
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
                .map(|data| data.arrival_time)
                .next()
        })
        .expect("No time specified for stdcm request")
}

/// get the maximum run time, compute it if unspecified.
/// returns an enum with either the result or a SimulationResponse if it failed
async fn get_maximum_run_time(
    db_pool: Arc<DbConnectionPoolV2>,
    redis_client: Arc<RedisClient>,
    core_client: Arc<CoreClient>,
    data: &STDCMRequestPayload,
    infra: &Infra,
    rolling_stock: &RollingStockModel,
    timetable_id: i64,
) -> Result<MaxRunningTimeResult> {
    if let Some(maximum_run_time) = data.maximum_run_time {
        return Ok(MaxRunningTimeResult::MaxRunningTime {
            value: maximum_run_time,
        });
    }

    // Doesn't matter for now, but eventually it will affect tmp speed limits
    let approx_start_time = get_earliest_step_time(data);

    let train_schedule = TrainSchedule {
        id: 0,
        train_name: "".to_string(),
        labels: vec![],
        rolling_stock_name: rolling_stock.name.clone(),
        timetable_id,
        start_time: approx_start_time,
        schedule: vec![],
        margins: build_single_margin(data.margin),
        initial_speed: 0.0,
        comfort: data.comfort,
        path: convert_steps(&data.steps),
        constraint_distribution: Default::default(),
        speed_limit_tag: data.speed_limit_tags.clone(),
        power_restrictions: vec![],
        options: Default::default(),
    };

    let (sim_result, _) = train_simulation(
        db_pool.get().await?.deref_mut(),
        redis_client,
        core_client,
        train_schedule,
        infra,
    )
    .await?;

    let total_stop_time: u64 = data
        .steps
        .iter()
        .map(|step: &PathfindingItem| step.duration.unwrap_or_default())
        .sum();

    return Ok(match sim_result {
        SimulationResponse::Success { provisional, .. } => MaxRunningTimeResult::MaxRunningTime {
            value: *provisional.times.last().expect("empty simulation result") * 2
                + total_stop_time,
        },
        err => MaxRunningTimeResult::Error {
            error: Box::from(err),
        },
    });
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
    maximum_departure_delay: u64,
    maximum_run_time: u64,
) -> Result<Vec<STDCMWorkSchedule>> {
    let maximum_simulation_time = maximum_run_time + maximum_departure_delay;
    let res = Ok(WorkSchedule::list(conn, Default::default())
        .await?
        .iter()
        .map(|ws| {
            let schedule = STDCMWorkSchedule {
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
        .filter(|ws| ws.end_time > 0 && ws.start_time < maximum_simulation_time)
        .collect());
    res
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
            PathfindingResult::InvalidPathItem { index, path_item } => {
                STDCMError::InvalidPathItem { index, path_item }
            }
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

enum MaxRunningTimeResult {
    MaxRunningTime { value: u64 },
    Error { error: Box<SimulationResponse> },
}
