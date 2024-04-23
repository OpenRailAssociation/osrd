use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::collections::HashSet;
use std::hash::Hash;
use std::hash::Hasher;

use diesel_async::AsyncPgConnection as PgConnection;
use editoast_derive::EditoastError;
use editoast_schemas::train_schedule::TrainScheduleBase;
use itertools::Itertools;
use serde_qs::actix::QsQuery;
use thiserror::Error;

use crate::core::v2::simulation::SimulationMargins;
use crate::core::v2::simulation::SimulationPath;
use crate::core::v2::simulation::SimulationPowerRestrictionItem;
use crate::core::v2::simulation::SimulationRequest;
use crate::core::v2::simulation::SimulationScheduleItem;
use crate::core::CoreClient;
use crate::error::Result;

use crate::client::get_app_version;
use crate::core::v2::pathfinding::PathfindingResult;
use crate::modelsv2::infra::Infra;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::train_schedule::TrainScheduleChangeset;
use crate::modelsv2::Model;
use crate::modelsv2::Retrieve;
use crate::modelsv2::RetrieveBatch;
use crate::views::v2::path::pathfinding_from_train;
use crate::views::v2::path::PathfindingError;
use crate::views::v2::path::TrackRange;
use crate::DbPool;
use crate::RedisClient;
use crate::RollingStockModel;
use editoast_common::Identifier;

use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, post, put, HttpResponse};
use serde::{Deserialize, Serialize};
use tracing::info;
use utoipa::{IntoParams, ToSchema};

const CACHE_SIMULATION_EXPIRATION: u64 = 604800;

crate::routes! {
    "/v2/train_schedule" => {
        post,
        delete,
        simulation_summary,
        project_path,
        "/{id}" => {
            get,
            put,
            simulation,

            "/path" => {
                get_path
            }
        }
    },
}

editoast_common::schemas! {
    TrainScheduleBase,
    TrainScheduleForm,
    TrainScheduleResult,
    BatchDeletionRequest,
    SimulationResult,
    ProjectPathResult,
    SimulationSummaryResultResponse,
    CompleteReportTrain,
    ReportTrain,
    InfraIdQueryParam,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_v2")]
#[allow(clippy::enum_variant_names)] // Variant have the same postfix by chance, it's not a problem
pub enum TrainScheduleError {
    #[error("Train Schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_id: i64 },
    #[error("{number} train schedule(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchTrainScheduleNotFound { number: usize },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

#[derive(IntoParams, Deserialize)]
struct TrainScheduleIdParam {
    /// A train schedule ID
    id: i64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleResult {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    pub train_schedule: TrainScheduleBase,
}

impl From<TrainSchedule> for TrainScheduleResult {
    fn from(value: TrainSchedule) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            train_schedule: TrainScheduleBase {
                train_name: value.train_name,
                labels: value.labels.into_iter().flatten().collect(),
                rolling_stock_name: value.rolling_stock_name,
                start_time: value.start_time,
                schedule: value.schedule,
                margins: value.margins,
                initial_speed: value.initial_speed,
                comfort: value.comfort,
                path: value.path,
                constraint_distribution: value.constraint_distribution,
                speed_limit_tag: value.speed_limit_tag.map(Into::into),
                power_restrictions: value.power_restrictions,
                options: value.options,
            },
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleForm {
    pub timetable_id: i64,
    #[serde(flatten)]
    pub train_schedule: TrainScheduleBase,
}

impl From<TrainScheduleForm> for TrainScheduleChangeset {
    fn from(value: TrainScheduleForm) -> Self {
        let TrainScheduleForm {
            timetable_id,
            train_schedule: ts,
        } = value;

        TrainSchedule::changeset()
            .timetable_id(timetable_id)
            .comfort(ts.comfort)
            .constraint_distribution(ts.constraint_distribution)
            .initial_speed(ts.initial_speed)
            .labels(ts.labels.into_iter().map(Some).collect())
            .margins(ts.margins)
            .path(ts.path)
            .power_restrictions(ts.power_restrictions)
            .rolling_stock_name(ts.rolling_stock_name)
            .schedule(ts.schedule)
            .speed_limit_tag(ts.speed_limit_tag.map(|s| s.0))
            .start_time(ts.start_time)
            .train_name(ts.train_name)
            .options(ts.options)
    }
}

#[derive(Debug, Deserialize, ToSchema)]
struct BatchDeletionRequest {
    ids: HashSet<i64>,
}

/// Create train schedule by batch
#[utoipa::path(
    tag = "train_schedulev2",
    request_body = Vec<TrainScheduleForm>,
    responses(
        (status = 200, description = "The train schedule", body = Vec<TrainScheduleResult>)
    )
)]
#[post("")]
async fn post(
    db_pool: Data<DbPool>,
    data: Json<Vec<TrainScheduleForm>>,
) -> Result<Json<Vec<TrainScheduleResult>>> {
    use crate::modelsv2::CreateBatch;

    let changesets: Vec<TrainScheduleChangeset> =
        data.into_inner().into_iter().map_into().collect();
    let conn = &mut db_pool.get().await?;

    // Create a batch of train_schedule
    let train_schedule: Vec<_> = TrainSchedule::create_batch(conn, changesets).await?;
    Ok(Json(train_schedule.into_iter().map_into().collect()))
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    tag = "train_schedulev2",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainScheduleResult)
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    train_schedule_id: Path<TrainScheduleIdParam>,
) -> Result<Json<TrainScheduleResult>> {
    let train_schedule_id = train_schedule_id.id;
    let conn = &mut db_pool.get().await?;

    // Return the timetable
    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(train_schedule.into()))
}

/// Delete a train schedule and its result
#[utoipa::path(
    tag = "train_schedulev2",
    request_body = inline(BatchDeletionRequest),
    responses(
        (status = 204, description = "All train schedules have been deleted")
    )
)]
#[delete("")]
async fn delete(db_pool: Data<DbPool>, data: Json<BatchDeletionRequest>) -> Result<HttpResponse> {
    use crate::modelsv2::DeleteBatch;

    let conn = &mut db_pool.get().await?;
    let train_ids = data.into_inner().ids;
    TrainSchedule::delete_batch_or_fail(conn, train_ids, |number| {
        TrainScheduleError::BatchTrainScheduleNotFound { number }
    })
    .await?;

    Ok(HttpResponse::NoContent().finish())
}

/// Update  train schedule at once
#[utoipa::path(
    tag = "train_schedulev2,timetable",
    request_body = TrainScheduleForm,
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule have been updated", body = TrainScheduleResult)
    )
)]
#[put("")]
async fn put(
    db_pool: Data<DbPool>,
    train_schedule_id: Path<TrainScheduleIdParam>,
    data: Json<TrainScheduleForm>,
) -> Result<Json<TrainScheduleResult>> {
    use crate::modelsv2::Update;
    let conn = &mut db_pool.get().await?;

    let train_id = train_schedule_id.id;
    let ts_changeset: TrainScheduleChangeset = data.into_inner().into();

    let ts_result = ts_changeset
        .update_or_fail(conn, train_id, || TrainScheduleError::NotFound {
            train_schedule_id: train_id,
        })
        .await?;

    Ok(Json(ts_result.into()))
}

// TODO: When can the simulation fail ?
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
enum SimulationResult {
    Success {
        #[schema(value_type = ReportTrainV2)]
        base: ReportTrain,
        #[schema(value_type = ReportTrainV2)]
        provisional: ReportTrain,
        final_output: CompleteReportTrain,
        mrsp: Mrsp,
        #[schema(inline)]
        power_restrictions: Vec<SimulationPowerRestrictionRange>,
    },
    PathfindingFailed {
        pathfinding_result: PathfindingResult,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SignalSighting {
    pub signal: String,
    // Time in ms
    pub time: u64,
    pub position: u64,
    pub state: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, ToSchema)]
#[schema(as = ReportTrainV2)]
pub struct ReportTrain {
    // List of positions of a train
    // Both positions (in mm) and times (in ms) must have the same length
    positions: Vec<u64>,
    times: Vec<u64>,
    // List of speeds associated to a position
    speeds: Vec<f64>,
    energy_consumption: f64,
}

#[derive(Deserialize, Serialize, Clone, Debug, ToSchema)]
pub struct CompleteReportTrain {
    #[serde(flatten)]
    #[schema(value_type = ReportTrainV2)]
    report_train: ReportTrain,
    signal_sightings: Vec<SignalSighting>,
    zone_updates: Vec<ZoneUpdate>,
    spacing_requirements: Vec<SpacingRequirement>,
    routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ZoneUpdate {
    pub zone: String,
    // Time in ms
    pub time: u64,
    pub position: u64,
    // TODO: see https://github.com/DGEXSolutions/osrd/issues/4294
    #[serde(rename = "isEntry")]
    pub is_entry: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SpacingRequirement {
    pub zone: String,
    // Time in ms
    pub begin_time: u64,
    // Time in ms
    pub end_time: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RoutingRequirement {
    pub route: String,
    /// Time in ms
    pub begin_time: u64,
    pub zones: Vec<RoutingZoneRequirement>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RoutingZoneRequirement {
    pub zone: String,
    pub entry_detector: String,
    pub exit_detector: String,
    pub switches: HashMap<String, String>,
    /// Time in ms
    pub end_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SimulationPowerRestrictionRange {
    /// Start position in the path in mm
    begin: u64,
    /// End position in the path in mm
    end: u64,
    code: String,
    /// Is power restriction handled during simulation
    handled: bool,
}

/// A MRSP computation result (Most Restrictive Speed Profile)
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct Mrsp(pub Vec<MrspPoint>);

/// An MRSP point
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct MrspPoint {
    /// Relative position of the point on its path (in milimeters)
    pub position: u64,
    /// Speed limit at this point (in m/s)
    pub speed: f64,
}

#[derive(Debug, Clone, Hash)]
struct SimulationInput {
    blocks: Vec<Identifier>,
    routes: Vec<Identifier>,
    track_section_ranges: Vec<TrackRange>,
}

/// Retrieve the space, speed and time curve of a given train
#[utoipa::path(
    tag = "train_schedulev2",
    params(TrainScheduleIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "Simulation Output", body = SimulationResult),
    ),
)]
#[get("/simulation")]
pub async fn simulation(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    core_client: Data<CoreClient>,
    train_schedule_id: Path<TrainScheduleIdParam>,
    query: Query<InfraIdQueryParam>,
) -> Result<Json<SimulationResult>> {
    let infra_id = query.into_inner().infra_id;
    let train_schedule_id = train_schedule_id.into_inner().id;
    let conn = &mut db_pool.get().await?;

    // Retrieve infra or fail
    let infra = Infra::retrieve_or_fail(conn, infra_id, || TrainScheduleError::InfraNotFound {
        infra_id,
    })
    .await?;

    // Retrieve train_schedule or fail
    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;

    Ok(Json(
        train_simulation(db_pool, redis_client, core_client, &train_schedule, &infra).await?,
    ))
}

/// Compute the simulation of a given train schedule
async fn train_simulation(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    core: Data<CoreClient>,
    train_schedule: &TrainSchedule,
    infra: &Infra,
) -> Result<SimulationResult> {
    let mut redis_conn = redis_client.get_connection().await?;
    let conn = &mut db_pool.get().await?;
    // Compute path
    let pathfinding_result =
        pathfinding_from_train(conn, &mut redis_conn, core, infra, train_schedule.clone()).await?;

    let (path, path_items_positions) = match pathfinding_result {
        PathfindingResult::Success {
            blocks,
            routes,
            track_section_ranges,
            path_items_positions,
            ..
        } => (
            SimulationPath {
                blocks,
                routes,
                track_section_ranges,
            },
            path_items_positions,
        ),
        _ => {
            return Ok(SimulationResult::PathfindingFailed { pathfinding_result });
        }
    };

    // Build simulation request
    let simulation_request =
        build_simulation_request(conn, train_schedule, &path_items_positions, path).await?;

    // Compute unique hash of SimulationInput
    let hash = train_simulation_input_hash(infra.id, &infra.version, &simulation_request);

    let result: Option<SimulationResult> = redis_conn
        .json_get_ex(&hash, CACHE_SIMULATION_EXPIRATION)
        .await?;
    if let Some(simulation_result) = result {
        info!("Simulation hit cache");
        return Ok(simulation_result);
    }

    // Compute simulation from core
    // TODO: Implement the simulation call

    let res = SimulationResult::Success {
        base: ReportTrain {
            speeds: vec![10.0, 27.0],
            positions: vec![20, 50],
            times: vec![27500, 35500],
            energy_consumption: 100.0,
        },
        provisional: ReportTrain {
            speeds: vec![10.0, 27.0],
            positions: vec![20, 50],
            times: vec![27500, 35500],
            energy_consumption: 100.0,
        },
        final_output: CompleteReportTrain {
            report_train: ReportTrain {
                speeds: vec![10.0, 27.0],
                positions: vec![2000, 5000],
                times: vec![27500, 35500],
                energy_consumption: 100.0,
            },
            signal_sightings: vec![SignalSighting {
                signal: "signal.0".into(),
                time: 28000,
                position: 3000,
                state: "VL".into(),
            }],
            zone_updates: vec![ZoneUpdate {
                zone: "zone.0".into(),
                time: 28000,
                position: 3000,
                is_entry: true,
            }],
            spacing_requirements: vec![SpacingRequirement {
                zone: "zone.0".into(),
                begin_time: 30000,
                end_time: 35500,
            }],
            routing_requirements: vec![RoutingRequirement {
                route: "route.0".into(),
                begin_time: 32000,
                zones: vec![],
            }],
        },
        mrsp: Mrsp(vec![]),
        power_restrictions: vec![],
    };

    // Cache the simulation response
    redis_conn
        .json_set_ex(&hash, &res, CACHE_SIMULATION_EXPIRATION)
        .await?;

    // Return the response
    Ok(res)
}

async fn build_simulation_request(
    conn: &mut PgConnection,
    train_schedule: &TrainSchedule,
    path_items_position: &[u64],
    path: SimulationPath,
) -> Result<SimulationRequest> {
    // Get rolling stock
    let rolling_stock_name = train_schedule.rolling_stock_name.clone();
    let rolling_stock = RollingStockModel::retrieve(conn, rolling_stock_name.clone())
        .await?
        .expect("Rolling stock should exist since the pathfinding succeeded");
    // Get electrical_profile_set_id
    let timetable_id = train_schedule.timetable_id;
    let timetable = Timetable::retrieve(conn, timetable_id)
        .await?
        .expect("Timetable should exist since it's a foreign key");

    assert_eq!(path_items_position.len(), train_schedule.path.len());

    // Project path items to path offset
    let path_items_to_position: HashMap<_, _> = train_schedule
        .path
        .iter()
        .map(|p| &p.id)
        .zip(path_items_position.iter().copied())
        .collect();

    let schedule = train_schedule
        .schedule
        .iter()
        .map(|schedule_item| SimulationScheduleItem {
            path_offset: path_items_to_position[&schedule_item.at],
            arrival: schedule_item
                .arrival
                .as_ref()
                .map(|t| t.num_milliseconds() as u64),
            stop_for: schedule_item
                .stop_for
                .as_ref()
                .map(|t| t.num_milliseconds() as u64),
        })
        .collect();

    let margins = SimulationMargins {
        boundaries: train_schedule
            .margins
            .boundaries
            .iter()
            .map(|at| path_items_to_position[at])
            .collect(),
        values: train_schedule.margins.values.clone(),
    };

    let power_restrictions = train_schedule
        .power_restrictions
        .iter()
        .map(|item| SimulationPowerRestrictionItem {
            from: path_items_to_position[&item.from],
            to: path_items_to_position[&item.to],
            value: item.value.clone(),
        })
        .collect();

    Ok(SimulationRequest {
        path,
        start_time: train_schedule.start_time,
        schedule,
        margins,
        initial_speed: train_schedule.initial_speed,
        comfort: train_schedule.comfort,
        constraint_distribution: train_schedule.constraint_distribution,
        speed_limit_tag: train_schedule.speed_limit_tag.clone(),
        power_restrictions,
        options: train_schedule.options.clone(),
        rolling_stock: rolling_stock.into(),
        electrical_profile_set_id: timetable.electrical_profile_set_id,
    })
}

// Compute hash input of a simulation
fn train_simulation_input_hash(
    infra_id: i64,
    infra_version: &String,
    simulation_input: &SimulationRequest,
) -> String {
    let osrd_version = get_app_version().unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    simulation_input.hash(&mut hasher);
    let hash_simulation_input = hasher.finish();
    format!("simulation_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, IntoParams)]
struct SimulationBatchParams {
    infra: i64,
    // list of train ids
    ids: Vec<i64>,
}

/// Project path output is described by time-space points and blocks
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ProjectPathResult {
    // List of positions of a train
    // Both positions and times must have the same length
    positions: Vec<u64>,
    // List of times associated to a position
    times: Vec<f64>,
    // List of blocks that are in the path
    blocks: Vec<SignalUpdate>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SignalUpdate {
    /// The id of the updated signal
    pub signal_id: String,
    /// The aspects start being displayed at this time (number of seconds since 1970-01-01T00:00:00)
    pub time_start: f64,
    /// The aspects stop being displayed at this time (number of seconds since 1970-01-01T00:00:00)
    #[schema(required)]
    pub time_end: Option<f64>,
    /// The route starts at this position on the train path
    pub position_start: u64,
    /// The route ends at this position on the train path
    #[schema(required)]
    pub position_end: Option<u64>,
    /// The color of the aspect
    /// (Bits 24-31 are alpha, 16-23 are red, 8-15 are green, 0-7 are blue)
    pub color: i32,
    /// Whether the signal is blinking
    pub blinking: bool,
    /// The labels of the new aspect
    pub aspect_label: String,
}

/// Projects the space time curves and paths of a number of train schedules onto a given path
/// Params are the infra_id and a list of train_ids
#[utoipa::path(
    tag = "train_schedulev2",
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<Identifier, ProjectPathResult>),
    ),
)]
#[post("/project_path")]
pub async fn project_path(
    _db_pool: Data<DbPool>,
    _redis_client: Data<RedisClient>,
    _params: QsQuery<SimulationBatchParams>,
    _core_client: Data<CoreClient>,
) -> Result<Json<HashMap<Identifier, ProjectPathResult>>> {
    // TO DO
    // issue: https://github.com/OpenRailAssociation/osrd/issues/6858
    Ok(Json(HashMap::new()))
}

#[derive(Debug, Serialize, ToSchema)]
enum SimulationSummaryResultResponse {
    // Minimal information on a simulation's result
    Success {
        // Length of a path in mm
        length: u64,
        // Travel time in ms
        time: u64,
        // Total energy consumption of a train in kWh
        energy_consumption: f64,
    },
    // Pathfinding fails for a train id
    PathfindingFailed,
    // Running time fails or a train id
    RunningTimeFailed,
}

/// Retrieve simulation information for a given train list.
/// Useful for finding out whether pathfinding/simulation was successful.
#[utoipa::path(
    tag = "train_schedulev2",
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<i64, SimulationSummaryResultResponse>),
    ),
)]
#[get("/simulation_summary")]
pub async fn simulation_summary(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    params: QsQuery<SimulationBatchParams>,
    core: Data<CoreClient>,
) -> Result<Json<HashMap<i64, SimulationSummaryResultResponse>>> {
    let query_props = params.into_inner();
    let infra_id = query_props.infra;
    let conn = &mut db_pool.clone().get().await?;

    let infra = Infra::retrieve_or_fail(conn, infra_id, || TrainScheduleError::InfraNotFound {
        infra_id,
    })
    .await?;
    let train_ids = query_props.ids;
    let train_schedule_batch: Vec<TrainSchedule> =
        TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;
    Ok(Json(
        build_simulation_summary_map(db_pool, redis_client, core, &train_schedule_batch, &infra)
            .await,
    ))
}

/// Associate each train id with its simulation summary response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
async fn build_simulation_summary_map(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    core_client: Data<CoreClient>,
    train_schedule_batch: &[TrainSchedule],
    infra: &Infra,
) -> HashMap<i64, SimulationSummaryResultResponse> {
    let mut simulation_summary_hashmap: HashMap<i64, SimulationSummaryResultResponse> =
        HashMap::new();
    for train_schedule in train_schedule_batch.iter() {
        let simulation_result = train_simulation(
            db_pool.clone(),
            redis_client.clone(),
            core_client.clone(),
            train_schedule,
            infra,
        )
        .await;
        let simulation_summary_result = if let Ok(train_simulation) = simulation_result {
            match train_simulation {
                SimulationResult::Success { final_output, .. } => {
                    SimulationSummaryResultResponse::Success {
                        length: *final_output.report_train.positions.last().unwrap(),
                        time: *final_output.report_train.times.last().unwrap(),
                        energy_consumption: final_output.report_train.energy_consumption,
                    }
                }
                SimulationResult::PathfindingFailed { .. } => {
                    SimulationSummaryResultResponse::PathfindingFailed
                }
            }
        } else {
            SimulationSummaryResultResponse::RunningTimeFailed
        };
        simulation_summary_hashmap.insert(train_schedule.id, simulation_summary_result);
    }
    simulation_summary_hashmap
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
pub struct InfraIdQueryParam {
    infra_id: i64,
}

/// Get a path from a trainschedule given an infrastructure id and a train schedule id
#[utoipa::path(
    tag = "train_schedulev2,pathfindingv2",
    params(TrainScheduleIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "The path", body = PathfindingResult),
        (status = 404, description = "Infrastructure or Train schedule not found")
    )
)]
#[get("")]
async fn get_path(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    core: Data<CoreClient>,
    train_schedule_id: Path<TrainScheduleIdParam>,
    query: Query<InfraIdQueryParam>,
) -> Result<Json<PathfindingResult>> {
    let conn = &mut db_pool.get().await?;
    let mut redis_conn = redis_client.get_connection().await?;

    let inner_query = query.into_inner();
    let infra_id = inner_query.infra_id;
    let train_schedule_id = train_schedule_id.id;

    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;
    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(
        pathfinding_from_train(conn, &mut redis_conn, core, &infra, train_schedule).await?,
    ))
}

#[cfg(test)]
mod tests {

    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::named_fast_rolling_stock;
    use crate::fixtures::tests::small_infra;
    use crate::fixtures::tests::timetable_v2;
    use crate::fixtures::tests::train_schedule_v2;
    use crate::fixtures::tests::TestFixture;
    use crate::fixtures::tests::TrainScheduleV2FixtureSet;
    use crate::modelsv2::infra::Infra;
    use crate::modelsv2::timetable::Timetable;
    use crate::modelsv2::Delete;
    use crate::modelsv2::DeleteStatic;
    use crate::views::tests::create_test_service;

    #[rstest]
    async fn get_trainschedule(
        #[future] train_schedule_v2: TrainScheduleV2FixtureSet,
        db_pool: Data<DbPool>,
    ) {
        let service = create_test_service().await;
        let fixture = train_schedule_v2.await;
        let url = format!("/v2/train_schedule/{}", fixture.train_schedule.id());

        // Should succeed
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete the train_schedule
        assert!(fixture
            .train_schedule
            .model
            .delete(&mut db_pool.get().await.unwrap())
            .await
            .unwrap());

        // Should fail
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_client_error());
    }

    #[rstest]
    async fn train_schedule_post(
        #[future] timetable_v2: TestFixture<Timetable>,
        db_pool: Data<DbPool>,
    ) {
        let service = create_test_service().await;

        let timetable = timetable_v2.await;
        // Insert train_schedule
        let train_schedule_base: TrainScheduleBase =
            serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse");
        let train_schedule = TrainScheduleForm {
            timetable_id: timetable.id(),
            train_schedule: train_schedule_base,
        };
        let request = TestRequest::post()
            .uri("/v2/train_schedule")
            .set_json(json!(vec![train_schedule]))
            .to_request();
        let response: Vec<TrainScheduleResult> = call_and_read_body_json(&service, request).await;
        assert_eq!(response.len(), 1);
        let train_id = response[0].id;

        // Delete the train_schedule
        assert!(
            TrainSchedule::delete_static(&mut db_pool.get().await.unwrap(), train_id)
                .await
                .is_ok()
        );
    }

    #[rstest]
    async fn train_schedule_delete(#[future] train_schedule_v2: TrainScheduleV2FixtureSet) {
        let fixture = train_schedule_v2.await;
        let service = create_test_service().await;
        let request = TestRequest::delete()
            .uri("/v2/train_schedule/")
            .set_json(json!({"ids": vec![fixture.train_schedule.id()]}))
            .to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete should fail

        let request = TestRequest::delete()
            .uri("/v2/train_schedule/")
            .set_json(json!({"ids": vec![fixture.train_schedule.id()]}))
            .to_request();
        assert_eq!(call_service(&service, request).await.status().as_u16(), 404);
    }

    #[rstest]
    async fn train_schedule_put(#[future] train_schedule_v2: TrainScheduleV2FixtureSet) {
        let TrainScheduleV2FixtureSet {
            timetable,
            train_schedule,
        } = train_schedule_v2.await;
        let service = create_test_service().await;
        let rs_name = String::from("NEW ROLLING_STOCK");
        let train_schedule_base: TrainScheduleBase = TrainScheduleBase {
            rolling_stock_name: rs_name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule_form = TrainScheduleForm {
            timetable_id: timetable.id(),
            train_schedule: train_schedule_base,
        };
        let request = TestRequest::put()
            .uri(format!("/v2/train_schedule/{}", train_schedule.id()).as_str())
            .set_json(json!(train_schedule_form))
            .to_request();

        let response: TrainScheduleResult = call_and_read_body_json(&service, request).await;
        assert_eq!(response.train_schedule.rolling_stock_name, rs_name)
    }

    #[rstest]
    #[ignore] // TODO: This test should be rewritten using mocks
    async fn train_schedule_simulation(
        #[future] timetable_v2: TestFixture<Timetable>,
        #[future] small_infra: TestFixture<Infra>,
        db_pool: Data<DbPool>,
    ) {
        let timetable = timetable_v2.await;
        let infra = small_infra.await;
        let rolling_stock =
            named_fast_rolling_stock("fast_rolling_stock_update_rolling_stock", db_pool.clone())
                .await;

        let train_schedule_base: TrainScheduleBase = TrainScheduleBase {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule = TrainScheduleForm {
            timetable_id: timetable.id(),
            train_schedule: train_schedule_base,
        };
        let request = TestRequest::post()
            .uri("/v2/train_schedule")
            .set_json(json!(vec![train_schedule]))
            .to_request();

        let service = create_test_service().await;
        let train_schedule: Vec<TrainScheduleResult> =
            call_and_read_body_json(&service, request).await;
        assert_eq!(train_schedule.len(), 1);
        let request = TestRequest::get()
            .uri(
                format!(
                    "/v2/train_schedule/{}/simulation/?infra_id={}",
                    train_schedule[0].id,
                    infra.id()
                )
                .as_str(),
            )
            .to_request();

        let response = call_service(&service, request).await;
        assert!(response.status().is_success());
    }

    #[rstest]
    #[ignore] // TODO: This test should be rewritten using mocks
    async fn train_schedule_simulation_summary(
        #[future] timetable_v2: TestFixture<Timetable>,
        #[future] small_infra: TestFixture<Infra>,
        db_pool: Data<DbPool>,
    ) {
        let timetable = timetable_v2.await;
        let infra = small_infra.await;
        let rolling_stock =
            named_fast_rolling_stock("simulation_summary_rolling_stock", db_pool.clone()).await;

        let train_schedule_base: TrainScheduleBase = TrainScheduleBase {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule = TrainScheduleForm {
            timetable_id: timetable.id(),
            train_schedule: train_schedule_base,
        };
        let request = TestRequest::post()
            .uri("/v2/train_schedule")
            .set_json(json!(vec![train_schedule]))
            .to_request();

        let service = create_test_service().await;
        let train_schedule: Vec<TrainScheduleResult> =
            call_and_read_body_json(&service, request).await;
        assert_eq!(train_schedule.len(), 1);
        let request = TestRequest::get()
            .uri(
                format!(
                    "/v2/train_schedule/simulation_summary/?infra={}&ids[]={}",
                    infra.id(),
                    train_schedule[0].id,
                )
                .as_str(),
            )
            .to_request();

        let response = call_service(&service, request).await;
        assert!(response.status().is_success());
    }
}
