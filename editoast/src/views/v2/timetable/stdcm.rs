use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use chrono::Utc;
use chrono::{DateTime, NaiveDateTime, TimeZone};
use editoast_derive::EditoastError;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::max;
use std::collections::HashMap;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::core::v2::simulation::SimulationResponse;
use crate::core::v2::stdcm::STDCMRequest;
use crate::core::v2::stdcm::STDCMResponse;
use crate::core::v2::stdcm::TrainRequirement;
use crate::core::v2::stdcm::{STDCMPathItem, STDCMWorkSchedule, UndirectedTrackRange};
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::modelsv2::timetable::TimetableWithTrains;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::work_schedules::WorkSchedule;
use crate::modelsv2::DbConnectionPoolV2;
use crate::modelsv2::RollingStockModel;
use crate::modelsv2::{DbConnection, Infra, List};
use crate::views::v2::path::pathfinding::extract_location_from_path_items;
use crate::views::v2::path::pathfinding::TrackOffsetExtractionError;
use crate::views::v2::train_schedule::train_simulation_batch;
use crate::RedisClient;
use crate::Retrieve;
use crate::RetrieveBatch;

crate::routes! {
    "/stdcm" => {
        stdcm,
    },
}

editoast_common::schemas! {
    STDCMRequestPayload,
    PathfindingItem,
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
    start_time: DateTime<Utc>,
    steps: Vec<PathfindingItem>,
    rolling_stock_id: i64,
    comfort: Comfort,
    /// By how long we can shift the departure time in milliseconds
    #[serde(default = "default_maximum_departure_delay")]
    #[schema(default = default_maximum_departure_delay)]
    maximum_departure_delay: u64,
    /// Specifies how long the total run time can be in milliseconds
    #[serde(default = "default_maximum_run_time")]
    #[schema(default = default_maximum_run_time)]
    maximum_run_time: u64,
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
    /// Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km` or `None`
    #[serde(default)]
    #[schema(value_type = Option<String>, example = json!(["None", "5%", "2min/100km"]))]
    margin: Option<MarginValue>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
struct PathfindingItem {
    /// The stop duration in milliseconds, None if the train does not stop.
    duration: Option<u64>,
    /// The associated location
    location: PathItemLocation,
}

const TWO_HOURS_IN_MILLISECONDS: u64 = 2 * 60 * 60 * 60;
const fn default_maximum_departure_delay() -> u64 {
    TWO_HOURS_IN_MILLISECONDS
}

const TWELVE_HOURS_IN_MILLISECONDS: u64 = 12 * 60 * 60 * 60;
const fn default_maximum_run_time() -> u64 {
    TWELVE_HOURS_IN_MILLISECONDS
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
    let conn = &mut db_pool.clone().get().await?;
    let db_pool = db_pool.into_inner();
    let core_client = core_client.into_inner();
    let timetable_id = id.into_inner();
    let infra_id = query.into_inner().infra;
    let data = data.into_inner();

    // 1. Retrieve Timetable / Infra / Trains / Simulation / Rolling Stock
    let timetable = TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || {
        STDCMError::TimetableNotFound { timetable_id }
    })
    .await?;

    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || STDCMError::InfraNotFound { infra_id }).await?;

    let (trains, _): (Vec<_>, _) = TrainSchedule::retrieve_batch(conn, timetable.train_ids).await?;

    let simulations = train_simulation_batch(
        db_pool.clone(),
        redis_client.into_inner().clone(),
        core_client.clone(),
        &trains,
        &infra,
    )
    .await?;

    let rolling_stock = RollingStockModel::retrieve_or_fail(conn, data.rolling_stock_id, || {
        STDCMError::RollingStockNotFound {
            rolling_stock_id: data.rolling_stock_id,
        }
    })
    .await?;

    // 2. Build core request
    let mut trains_requirements = HashMap::new();
    for (train, sim) in trains.iter().zip(simulations) {
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

    // 3. Parse stdcm path items
    let path_items = parse_stdcm_steps(conn, &data, &infra).await?;

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
        start_time: data.start_time,
        trains_requirements,
        maximum_departure_delay: Some(data.maximum_departure_delay),
        maximum_run_time: data.maximum_run_time,
        speed_limit_tag: data.speed_limit_tags,
        time_gap_before: data.time_gap_before,
        time_gap_after: data.time_gap_after,
        margin: data.margin,
        time_step: Some(2000),
        work_schedules: build_work_schedules(
            conn,
            data.start_time,
            data.maximum_departure_delay,
            data.maximum_run_time,
        )
        .await?,
    }
    .fetch(core_client.as_ref())
    .await?;

    Ok(Json(stdcm_response))
}

async fn build_work_schedules(
    conn: &mut DbConnection,
    time: DateTime<Utc>,
    max_departure_delay: u64,
    max_run_time: u64,
) -> Result<Vec<STDCMWorkSchedule>> {
    let max_simulation_time = max_run_time + max_departure_delay;
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
        .filter(|ws| ws.end_time > 0 && ws.start_time < max_simulation_time)
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
    let path_items = data.steps.clone();
    let mut locations = Vec::with_capacity(path_items.len());
    let mut durations = Vec::with_capacity(path_items.len());
    for item in path_items {
        locations.push(item.location);
        durations.push(item.duration);
    }

    let track_offsets = extract_location_from_path_items(conn, infra.id, &locations).await?;
    let track_offsets = track_offsets.map_err::<STDCMError, _>(|err| err.into())?;

    Ok(track_offsets
        .iter()
        .zip(durations)
        .map(|(track_offset, duration)| STDCMPathItem {
            stop_duration: duration,
            locations: track_offset.to_vec(),
        })
        .collect())
}

impl From<TrackOffsetExtractionError> for STDCMError {
    fn from(error: TrackOffsetExtractionError) -> Self {
        STDCMError::InvalidPathItem {
            index: error.index,
            path_item: error.path_item,
        }
    }
}
