use crate::core::CoreClient;
use crate::error::Result;
use crate::models::RoutingRequirement;
use crate::models::SpacingRequirement;
use crate::modelsv2::train_schedule::{TrainSchedule, TrainScheduleChangeset};
use crate::modelsv2::Model;
use crate::schema::utils::Identifier;
use crate::schema::v2::trainschedule::Distribution;
use crate::schema::v2::trainschedule::TrainScheduleBase;

use crate::{DbPool, RedisClient};
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, post, put, HttpResponse};
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use serde_qs::actix::QsQuery;
use std::collections::{HashMap, HashSet};
use thiserror::Error;
use utoipa::{IntoParams, ToSchema};

crate::routes! {
    "/v2/train_schedule" => {
        post,
        delete,
        simulations_summary,
        project_path,
        "/{id}" => {
            get,
            put,
            simulation_output,
        }
    },
}

crate::schemas! {
    Distribution,
    TrainScheduleBase,
    TrainScheduleForm,
    TrainScheduleResult,
    BatchDeletionRequest,
    SimulationOutput,
    ProjectPathParams,
    ProjectPathResult,
    SimulationSummaryResultResponse,
    CompleteReportTrain,
    ReportTrain,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_v2")]
pub enum TrainScheduleError {
    #[error("Train Schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_id: i64 },
    #[error("{number} train schedule(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchTrainScheduleNotFound { number: usize },
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
    use crate::modelsv2::Retrieve;

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

#[derive(Deserialize, Serialize, Clone, Debug, ToSchema)]
struct SimulationOutput {
    base: ReportTrain,
    provisional: ReportTrain,
    final_output: CompleteReportTrain,
    mrsp: Mrsp,
    power_restriction: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SignalSighting {
    pub signal: String,
    pub time: f64,
    pub position: u64,
    pub state: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, ToSchema)]
#[schema(as = ReportTrainV2)]
struct ReportTrain {
    // List of positions of a train
    // Both positions and times must have the same length
    positions: Vec<u64>,
    times: Vec<f64>,
    // List of speeds associated to a position
    speeds: Vec<f64>,
    energy_consumption: f64,
}

#[derive(Deserialize, Serialize, Clone, Debug, ToSchema)]
struct CompleteReportTrain {
    #[serde(flatten)]
    report_train: ReportTrain,
    signal_sightings: Vec<SignalSighting>,
    zone_updates: Vec<ZoneUpdate>,
    spacing_requirements: Vec<SpacingRequirement>,
    routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ZoneUpdate {
    pub zone: String,
    pub time: f64,
    pub position: u64,
    // TODO: see https://github.com/DGEXSolutions/osrd/issues/4294
    #[serde(rename = "isEntry")]
    pub is_entry: bool,
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

/// Retrieve the space, speed and time curve of a given train
#[utoipa::path(
    tag = "train_schedulev2",
    params(
        ("id" = i64, Path, description = "The timetable id"),
        ("infra_id" = i64, Path, description = "The infra id"),
    ),
    responses(
        (status = 200, description = "Simulation Output", body = SimulationOutput),
    ),
)]
#[get("/simulation")]
pub async fn simulation_output(
    _db_pool: Data<DbPool>,
    _redis_client: Data<RedisClient>,
    _train_schedule_id: Path<i64>,
    _params: Query<i64>,
) -> Result<Json<SimulationOutput>> {
    // IMPLEMENT THIS FUNCTION
    // issue: https://github.com/osrd-project/osrd/issues/6853

    Ok(Json(SimulationOutput {
        base: ReportTrain {
            speeds: vec![10.0, 27.0],
            positions: vec![20, 50],
            times: vec![27.5, 35.5],
            energy_consumption: 100.0,
        },
        provisional: ReportTrain {
            speeds: vec![10.0, 27.0],
            positions: vec![20, 50],
            times: vec![27.5, 35.5],
            energy_consumption: 100.0,
        },
        final_output: CompleteReportTrain {
            report_train: ReportTrain {
                speeds: vec![10.0, 27.0],
                positions: vec![2000, 5000],
                times: vec![27.5, 35.5],
                energy_consumption: 100.0,
            },
            signal_sightings: vec![SignalSighting {
                signal: "signal.0".into(),
                time: 28.0,
                position: 3000,
                state: "VL".into(),
            }],
            zone_updates: vec![ZoneUpdate {
                zone: "zone.0".into(),
                time: 28.0,
                position: 3000,
                is_entry: true,
            }],
            spacing_requirements: vec![SpacingRequirement {
                zone: "zone.0".into(),
                begin_time: 30.0,
                end_time: 35.5,
            }],
            routing_requirements: vec![RoutingRequirement {
                route: "route.0".into(),
                begin_time: 32.0,
                zones: vec![],
            }],
        },
        mrsp: Mrsp(vec![]),
        power_restriction: "".into(),
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema, IntoParams)]
struct ProjectPathParams {
    infra: i64,
    train_ids: Vec<i64>,
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
    _params: QsQuery<ProjectPathParams>,
    _core_client: Data<CoreClient>,
) -> Result<Json<HashMap<Identifier, ProjectPathResult>>> {
    // TO DO
    // issue: https://github.com/osrd-project/osrd/issues/6858
    Ok(Json(HashMap::new()))
}

#[derive(Debug, Serialize, ToSchema)]
enum SimulationSummaryResultResponse {
    // Minimal information on a simulation's result
    #[allow(dead_code)]
    Success {
        // Length of a path
        length: u64,
        // travel time
        time: f64,
        energy_consumption: f64,
    },
    // Pathfinding not found for a train id
    #[allow(dead_code)]
    PathfindingNotFound,
    // Running time not found or a train id
    #[allow(dead_code)]
    RunningTimeNotFound,
}

/// Retrieve simulation information for a given train list.
/// Useful for finding out whether pathfinding/simulation was successful.
#[utoipa::path(
    tag = "train_schedulev2",
    responses(
        (status = 200, description = "Project Path Output", body = HashMap<Identifier, SimulationSummaryResultResponse>),
    ),
)]
#[get("/simulation_summary")]
pub async fn simulations_summary(
    _db_pool: Data<DbPool>,
    _redis_client: Data<RedisClient>,
    _params: QsQuery<ProjectPathParams>,
    _core_client: Data<CoreClient>,
    _infra_id: Query<i64>,
) -> Result<Json<HashMap<Identifier, SimulationSummaryResultResponse>>> {
    // TO DO
    // issue:x https://github.com/osrd-project/osrd/issues/6857
    Ok(Json(HashMap::new()))
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::fixtures::tests::{
        db_pool, timetable_v2, train_schedule_v2, TestFixture, TrainScheduleV2FixtureSet,
    };
    use crate::modelsv2::timetable::Timetable;
    use crate::modelsv2::{Delete, DeleteStatic};
    use crate::views::tests::create_test_service;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};
    use rstest::rstest;
    use serde_json::json;

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
}
