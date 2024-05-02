mod projection;

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::collections::HashSet;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;

use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, put, HttpResponse};
use editoast_derive::EditoastError;
use editoast_schemas::train_schedule::TrainScheduleBase;
use serde::Deserialize;
use serde::Serialize;
use serde_qs::actix::QsQuery;
use thiserror::Error;
use tracing::info;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::v2::pathfinding::PathfindingResult;
use crate::core::v2::simulation::CompleteReportTrain;
use crate::core::v2::simulation::ReportTrain;
use crate::core::v2::simulation::SignalSighting;
use crate::core::v2::simulation::SimulationMargins;
use crate::core::v2::simulation::SimulationPath;
use crate::core::v2::simulation::SimulationPowerRestrictionItem;
use crate::core::v2::simulation::SimulationRequest;
use crate::core::v2::simulation::SimulationResponse;
use crate::core::v2::simulation::SimulationScheduleItem;
use crate::core::v2::simulation::ZoneUpdate;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::modelsv2::infra::Infra;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::train_schedule::TrainScheduleChangeset;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Model;
use crate::modelsv2::Retrieve;
use crate::modelsv2::RetrieveBatch;
use crate::views::v2::path::pathfinding_from_train;
use crate::views::v2::path::PathfindingError;
use crate::RedisClient;
use crate::RollingStockModel;

const CACHE_SIMULATION_EXPIRATION: u64 = 604800; // 1 week

crate::routes! {
    "/v2/train_schedule" => {
        delete,
        simulation_summary,
        projection::routes(),
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
    SimulationSummaryResult,
    InfraIdQueryParam,
    projection::schemas(),
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
    /// Timetable attached to the train schedule
    pub timetable_id: Option<i64>,
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
            .flat_timetable_id(timetable_id)
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

/// Return a specific train schedule
#[utoipa::path(
    tag = "train_schedulev2",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainScheduleResult)
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPool>,
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
async fn delete(
    db_pool: Data<DbConnectionPool>,
    data: Json<BatchDeletionRequest>,
) -> Result<HttpResponse> {
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
    db_pool: Data<DbConnectionPool>,
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

/// Retrieve the space, speed and time curve of a given train
#[utoipa::path(
    tag = "train_schedulev2",
    params(TrainScheduleIdParam, InfraIdQueryParam),
    responses(
        (status = 200, description = "Simulation Output", body = SimulationResponse),
    ),
)]
#[get("/simulation")]
pub async fn simulation(
    db_pool: Data<DbConnectionPool>,
    redis_client: Data<RedisClient>,
    core_client: Data<CoreClient>,
    train_schedule_id: Path<TrainScheduleIdParam>,
    query: Query<InfraIdQueryParam>,
) -> Result<Json<SimulationResponse>> {
    let infra_id = query.into_inner().infra_id;
    let train_schedule_id = train_schedule_id.into_inner().id;
    let conn = &mut db_pool.get().await?;
    let db_pool = db_pool.into_inner();
    let redis_client = redis_client.into_inner();
    let core_client = core_client.into_inner();

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
    db_pool: Arc<DbConnectionPool>,
    redis_client: Arc<RedisClient>,
    core: Arc<CoreClient>,
    train_schedule: &TrainSchedule,
    infra: &Infra,
) -> Result<SimulationResponse> {
    let mut redis_conn = redis_client.get_connection().await?;
    let conn = &mut db_pool.get().await?;
    // Compute path
    let pathfinding_result = pathfinding_from_train(
        conn,
        &mut redis_conn,
        core.clone(),
        infra,
        train_schedule.clone(),
    )
    .await?;

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
            return Ok(SimulationResponse::PathfindingFailed { pathfinding_result });
        }
    };

    // Build simulation request
    let simulation_request =
        build_simulation_request(conn, infra, train_schedule, &path_items_positions, path).await?;

    // Compute unique hash of the simulation input
    let hash = train_simulation_input_hash(infra.id, &infra.version, &simulation_request);

    let result: Option<SimulationResponse> = redis_conn
        .json_get_ex(&hash, CACHE_SIMULATION_EXPIRATION)
        .await?;
    if let Some(simulation_result) = result {
        info!("Simulation hit cache");
        return Ok(simulation_result);
    }

    // Compute simulation from core
    let result = simulation_request.fetch(core.as_ref()).await?;

    // Cache the simulation response
    redis_conn
        .json_set_ex(&hash, &result, CACHE_SIMULATION_EXPIRATION)
        .await?;

    // Return the response
    Ok(result)
}

async fn build_simulation_request(
    conn: &mut DbConnection,
    infa: &Infra,
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
            on_stop_signal: schedule_item.on_stop_signal,
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
        infra: infa.id,
        expected_version: infa.version.clone(),
        path,
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

#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
enum SimulationSummaryResult {
    /// Minimal information on a simulation's result
    Success {
        /// Length of a path in mm
        length: u64,
        /// Travel time in ms
        time: u64,
        /// Total energy consumption of a train in kWh
        energy_consumption: f64,
    },
    /// Pathfinding not found
    PathfindingNotFound,
    /// An error has occured during pathfinding
    PathfindingFailed { error_type: String },
    /// An error has occured during computing
    SimulationFailed { error_type: String },
    /// Rolling stock not found
    RollingStockNotFound { rolling_stock_name: String },
}

/// Associate each train id with its simulation summary response
/// If the simulation fails, it associates the reason: pathfinding failed or running time failed
#[utoipa::path(
    tag = "train_schedulev2",
    params(
        ("infra" = i64, Query, description = "The infra id"),
        ("ids" = Vec<i64>, Query, description = "Ids of train schedule"),
    ),
    responses(
        (status = 200, description = "Associate each train id with its simulation summary", body = HashMap<i64, SimulationSummaryResult>),
    ),
)]
#[get("/simulation_summary")]
pub async fn simulation_summary(
    db_pool: Data<DbConnectionPool>,
    redis_client: Data<RedisClient>,
    params: QsQuery<SimulationBatchParams>,
    core: Data<CoreClient>,
) -> Result<Json<HashMap<i64, SimulationSummaryResult>>> {
    let query_props = params.into_inner();
    let infra_id = query_props.infra;
    let conn = &mut db_pool.clone().get().await?;
    let db_pool = db_pool.into_inner();
    let redis_client = redis_client.into_inner();
    let core = core.into_inner();

    let infra = Infra::retrieve_or_fail(conn, infra_id, || TrainScheduleError::InfraNotFound {
        infra_id,
    })
    .await?;
    let train_ids = query_props.ids;
    let trains: Vec<TrainSchedule> =
        TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            TrainScheduleError::BatchTrainScheduleNotFound {
                number: missing.len(),
            }
        })
        .await?;

    let simulations = train_simulation_batch(db_pool, redis_client, core, &trains, &infra).await?;

    // Transform simulations to simulation summary
    let mut simulation_summaries = HashMap::new();
    for (train, sim) in trains.iter().zip(simulations) {
        let simulation_summary_result = match sim {
            SimulationResponse::Success { final_output, .. } => {
                let report = final_output.report_train;
                SimulationSummaryResult::Success {
                    length: *report.positions.last().unwrap(),
                    time: *report.times.last().unwrap(),
                    energy_consumption: report.energy_consumption,
                }
            }
            SimulationResponse::PathfindingFailed { pathfinding_result } => {
                match pathfinding_result {
                    PathfindingResult::PathfindingFailed { core_error } => {
                        SimulationSummaryResult::PathfindingFailed {
                            error_type: core_error.get_type().into(),
                        }
                    }
                    PathfindingResult::RollingStockNotFound { rolling_stock_name } => {
                        SimulationSummaryResult::RollingStockNotFound { rolling_stock_name }
                    }
                    _ => SimulationSummaryResult::PathfindingNotFound,
                }
            }
            SimulationResponse::SimulationFailed { core_error } => {
                SimulationSummaryResult::SimulationFailed {
                    error_type: core_error.get_type().into(),
                }
            }
        };
        simulation_summaries.insert(train.id, simulation_summary_result);
    }

    Ok(Json(simulation_summaries))
}

/// Compute train simulation in batch given a list of train schedules.
///
/// Note: The order of the returned simulations is the same as the order of the train schedules.
///
/// Returns an error if any of the train ids are not found.
pub async fn train_simulation_batch(
    db_pool: Arc<DbConnectionPool>,
    redis_client: Arc<RedisClient>,
    core_client: Arc<CoreClient>,
    train_schedules: &[TrainSchedule],
    infra: &Infra,
) -> Result<Vec<SimulationResponse>> {
    let mut pending_simulations = vec![];
    for train_schedule in train_schedules.iter() {
        pending_simulations.push(train_simulation(
            db_pool.clone(),
            redis_client.clone(),
            core_client.clone(),
            train_schedule,
            infra,
        ));
    }

    let simulations = futures::future::join_all(pending_simulations).await;
    simulations.into_iter().collect()
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
    db_pool: Data<DbConnectionPool>,
    redis_client: Data<RedisClient>,
    core: Data<CoreClient>,
    train_schedule_id: Path<TrainScheduleIdParam>,
    query: Query<InfraIdQueryParam>,
) -> Result<Json<PathfindingResult>> {
    let conn = &mut db_pool.get().await?;
    let mut redis_conn = redis_client.get_connection().await?;
    let core = core.into_inner();

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
        db_pool: Data<DbConnectionPool>,
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
        db_pool: Data<DbConnectionPool>,
    ) {
        let service = create_test_service().await;

        let timetable = timetable_v2.await;
        // Insert train_schedule
        let train_schedule: TrainScheduleBase =
            serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse");
        let request = TestRequest::post()
            .uri(format!("/v2/timetable/{}/train_schedule", timetable.id()).as_str())
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
            timetable_id: Some(timetable.id()),
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
        db_pool: Data<DbConnectionPool>,
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
            timetable_id: Some(timetable.id()),
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
        db_pool: Data<DbConnectionPool>,
    ) {
        let timetable = timetable_v2.await;
        let infra = small_infra.await;
        let rolling_stock =
            named_fast_rolling_stock("simulation_summary_rolling_stock", db_pool.clone()).await;

        let train_schedule: TrainScheduleBase = TrainScheduleBase {
            rolling_stock_name: rolling_stock.name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let request = TestRequest::post()
            .uri(format!("/v2/timetable/{}/train_schedule", timetable.id()).as_str())
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
