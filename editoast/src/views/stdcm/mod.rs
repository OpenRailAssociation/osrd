use crate::core::stdcm::{
    STDCMCoreRequest, STDCMCoreResponse, STDCMCoreRouteOccupancy, STDCMCoreStep,
};
use crate::core::{AsCoreRequest, CoreClient};
use crate::error::Result;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::models::Create;
use crate::models::{
    simulation_output::OutputSimulationTrainSchedule, CurveGraph, Infra, PathWaypoint, Pathfinding,
    PathfindingChangeset, PathfindingPayload, Retrieve, SlopeGraph, TrainSchedule,
};
use crate::views::rolling_stocks::retrieve_existing_rolling_stock;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, block, Data, Json};
use actix_web::{post, HttpResponse, Responder};

use super::pathfinding::{
    fetch_pathfinding_payload_track_map, parse_pathfinding_payload_waypoints, StepPayload,
};
use super::train_schedule::process_simulation_response;
use super::train_schedule::projection::Projection;
use super::train_schedule::simulation_report::{create_simulation_report, SimulationReport};

use crate::schema::utils::geometry::diesel_linestring_to_geojson;
use chrono::{DateTime, Utc};
use derivative::Derivative;
use geos::geojson::Geometry;
use uuid::Uuid;

use crate::schema::rolling_stock::RollingStockComfortType;

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/stdcm").service(create)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct STDCMRequestPayload {
    pub infra_id: i64,
    pub timetable_id: i64,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub steps: Vec<StepPayload>,
    pub rolling_stocks: Vec<i64>,
    pub rolling_stock_id: i64,
    pub comfort: RollingStockComfortType,
    pub maximum_departure_delay: Option<f64>,
    pub maximum_run_time: Option<f64>,
    pub speed_limit_tags: Option<String>,
    pub margin_before: Option<f64>,
    pub margin_after: Option<f64>,
    pub standard_allowance: Option<AllowanceValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "value_type", rename_all = "lowercase")]
pub enum AllowanceValue {
    TimePerDistance(AllowanceTimePerDistanceValue),
    Time(AllowanceTimeValue),
    Percentage(AllowancePercentValue),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AllowanceTimePerDistanceValue {
    minutes: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AllowanceTimeValue {
    seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AllowancePercentValue {
    percentage: f64,
}
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct STDCMResponse {
    pub path: STDCMPath,
    pub simulation: SimulationReport,
}

#[derive(Serialize, Deserialize, Debug, Derivative)]
#[derivative(PartialEq)]
pub struct STDCMPath {
    #[derivative(PartialEq = "ignore")]
    pub id: i64,
    pub owner: Uuid,
    #[derivative(PartialEq = "ignore")]
    pub created: DateTime<Utc>,
    pub length: Option<f64>,
    pub slopes: SlopeGraph,
    pub curves: CurveGraph,
    #[derivative(Default(value = "Geometry::new(LineString(Default::default()))"))]
    pub geographic: Geometry,
    #[derivative(Default(value = "Geometry::new(LineString(Default::default()))"))]
    pub schematic: Geometry,
    pub steps: Vec<PathWaypoint>,
    #[serde(skip)]
    #[derivative(PartialEq = "ignore")]
    pub payload: PathfindingPayload,
}

impl From<PathfindingChangeset> for STDCMPath {
    fn from(changeset: PathfindingChangeset) -> Self {
        let payload = changeset.payload.unwrap();
        Self {
            id: changeset.id.expect("id is missing"),
            owner: changeset.owner.expect("owner is missing"),
            created: DateTime::from_utc(
                changeset.created.expect("created timestamp is missing"),
                Utc,
            ),
            length: changeset.length,
            slopes: changeset
                .slopes
                .unwrap_or_else(|| diesel_json::Json(Vec::new()))
                .to_vec(),
            curves: changeset
                .curves
                .unwrap_or_else(|| diesel_json::Json(Vec::new()))
                .to_vec(),
            geographic: diesel_linestring_to_geojson(changeset.geographic.unwrap()),
            schematic: diesel_linestring_to_geojson(changeset.schematic.unwrap()),
            steps: payload.path_waypoints.clone(),
            payload: payload.0,
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

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
    data: Json<STDCMRequestPayload>,
) -> Result<impl Responder> {
    let stdcm_response = compute_stdcm(db_pool, core, data).await?;
    Ok(HttpResponse::Created().json(stdcm_response))
}

async fn compute_stdcm(
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
    data: Json<STDCMRequestPayload>,
) -> Result<STDCMResponse> {
    let core_output = call_core_stdcm(db_pool.clone(), &core, &data).await?;
    let path = create_path_from_core_response(db_pool.clone(), &core_output, &data).await?;
    let simulation =
        create_simulation_from_core_response(db_pool, &core, &data, &core_output, &path).await?;
    Ok(STDCMResponse { path, simulation })
}

async fn call_core_stdcm(
    db_pool: Data<DbPool>,
    core: &Data<CoreClient>,
    data: &Json<STDCMRequestPayload>,
) -> Result<STDCMCoreResponse> {
    let infra = Infra::retrieve(db_pool.clone(), data.infra_id)
        .await?
        .ok_or(StdcmError::InfraNotFound {
            infra_id: data.infra_id,
        })?;
    let rolling_stock = retrieve_existing_rolling_stock(&db_pool, data.rolling_stock_id).await?;

    let steps = parse_stdcm_steps(db_pool.clone(), data, &infra).await?;
    let route_occupancies = make_route_occupancies(db_pool, data.timetable_id).await?;
    STDCMCoreRequest {
        infra: infra.id.unwrap().to_string(),
        expected_version: infra.version.unwrap(),
        rolling_stock,
        comfort: data.comfort.clone(),
        steps,
        route_occupancies,
        // end_time is not used by backend currently
        // but at least one must be defined
        start_time: data.start_time,
        end_time: match data.start_time {
            Some(_) => None,
            None => data.end_time,
        },
        maximum_departure_delay: data.maximum_departure_delay,
        maximum_run_time: data.maximum_run_time,
        speed_limit_tags: data.speed_limit_tags.clone(),
        margin_before: data.margin_before.unwrap(),
        margin_after: data.margin_after.unwrap(),
        standard_allowance: data.standard_allowance.clone().unwrap(),
        time_step: Some(2.0),
    }
    .fetch(core)
    .await
}

/// create steps from track_map and waypoints
async fn parse_stdcm_steps(
    db_pool: Data<DbPool>,
    data: &Json<STDCMRequestPayload>,
    infra: &Infra,
) -> Result<Vec<STDCMCoreStep>> {
    let steps = data.steps.clone();
    let infra_id = infra.id.unwrap();
    block(move || {
        let conn = &mut db_pool.get()?;
        let track_map = fetch_pathfinding_payload_track_map(conn, infra_id, &steps)?;
        let waypoints = parse_pathfinding_payload_waypoints(&steps, &track_map);
        Ok(waypoints
            .unwrap()
            .iter()
            .zip(steps.iter())
            .map(|(wp, StepPayload { duration, .. })| STDCMCoreStep {
                stop_duration: *duration,
                stop: *duration > 0.,
                waypoints: wp.to_vec(),
            })
            .collect())
    })
    .await
    .unwrap()
}

/// Create route occupancies, adjusted by simulation departure time.
/// uses base_simulation by default, or eco_simulation if given
async fn make_route_occupancies(
    db_pool: Data<DbPool>,
    timetable_id: i64,
) -> Result<Vec<STDCMCoreRouteOccupancy>> {
    let simulations =
        OutputSimulationTrainSchedule::from_timetable_id(timetable_id, db_pool).await?;
    Ok(simulations
        .iter()
        .flat_map(|simulation| {
            let sim = simulation
                .simulation_output
                .eco_simulation
                .as_ref()
                .unwrap_or(&simulation.simulation_output.base_simulation);
            sim.route_occupancies
                .iter()
                .map(|(route_id, occupancy)| STDCMCoreRouteOccupancy {
                    id: route_id.to_string(),
                    start_occupancy_time: occupancy.time_head_occupy
                        + simulation.schedule_departure_time.unwrap(),
                    end_occupancy_time: occupancy.time_tail_free
                        + simulation.schedule_departure_time.unwrap(),
                })
        })
        .collect())
}

/// Creates a Pathfinding using the same function used with core /pathfinding response
async fn create_path_from_core_response(
    db_pool: Data<DbPool>,
    core_output: &STDCMCoreResponse,
    data: &Json<STDCMRequestPayload>,
) -> Result<STDCMPath> {
    let core_path_response = core_output.path.clone();
    let steps = data.steps.clone();
    let infra_id = data.infra_id;
    let pathfinding_cs = block(move || {
        let conn = &mut db_pool.get()?;
        let track_map = core_path_response.fetch_track_map(infra_id, conn)?;
        let op_map = core_path_response.fetch_op_map(infra_id, conn)?;
        let pathfinding_from_response =
            Pathfinding::from_core_response(steps, core_path_response, &track_map, &op_map)?;
        PathfindingChangeset {
            id: None,
            infra_id: Some(infra_id),
            ..pathfinding_from_response.into()
        }
        .create_conn(conn)
    })
    .await
    .unwrap()?;
    Ok(pathfinding_cs.into())
}

/// processes the stdcm simulation and create a simulation report
async fn create_simulation_from_core_response(
    db_pool: Data<DbPool>,
    core: &Data<CoreClient>,
    data: &Json<STDCMRequestPayload>,
    core_output: &STDCMCoreResponse,
    path: &STDCMPath,
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
        db_pool.clone(),
        core,
    )
    .await
}

#[cfg(test)]
pub mod tests {
    use super::STDCMResponse;
    use crate::assert_status_and_read;
    use crate::core::mocking::MockingClient;
    use crate::fixtures::tests::{fast_rolling_stock, small_infra, timetable, TestFixture};
    use crate::models::{Infra, RollingStockModel, Timetable};
    use crate::views::tests::{create_test_service, create_test_service_with_core_client};
    use actix_http::StatusCode;
    use actix_web::test::{call_service, TestRequest};
    use serde_json::{from_str, from_value, json, Value};

    /// conditions: one train scheduled for 8:00
    /// stdcm looks for a spot between 8:00 and 10:00
    #[rstest::rstest]
    async fn stdcm_should_return_path_and_simulation(
        #[future] small_infra: TestFixture<Infra>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
        #[future] timetable: TestFixture<Timetable>,
    ) {
        let small_infra = small_infra.await;
        let fast_rolling_stock = fast_rolling_stock.await;
        let timetable = timetable.await;
        let mut payload: Value = from_str(include_str!(
            "../../tests/small_infra/stdcm/test_1/stdcm_post_payload.json"
        ))
        .unwrap();
        *payload.get_mut("infra_id").unwrap() = json!(small_infra.id());
        *payload.get_mut("rolling_stocks").unwrap() = json!([fast_rolling_stock.id()]);
        *payload.get_mut("rolling_stock_id").unwrap() = json!(fast_rolling_stock.id());
        *payload.get_mut("timetable_id").unwrap() = json!(timetable.id());

        let mut core = MockingClient::new();
        core.stub("/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body(include_str!(
                "../../tests/small_infra/stdcm/test_1/stdcm_core_response.json"
            ))
            .finish();
        core.stub("/project_signals")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body(include_str!(
                "../../tests/small_infra/stdcm/test_1/project_signal_response.json"
            ))
            .finish();
        let app = create_test_service_with_core_client(core).await;

        let req = TestRequest::post()
            .uri("/stdcm/")
            .set_json(payload)
            .to_request();

        let service_response = call_service(&app, req).await;
        let stdcm_response: STDCMResponse =
            assert_status_and_read!(service_response, StatusCode::CREATED);
        let mut expected_response: Value = from_str(include_str!(
            "../../tests/small_infra/stdcm/test_1/stdcm_post_expected_response.json"
        ))
        .unwrap();
        *expected_response
            .get_mut("simulation")
            .unwrap()
            .get_mut("path")
            .unwrap() = json!(stdcm_response.path.id);
        let expected_response: STDCMResponse = from_value(expected_response).unwrap();
        assert_eq!(stdcm_response.path, expected_response.path);
        assert_eq!(stdcm_response.simulation, expected_response.simulation);
    }

    ///
    #[rstest::rstest]
    async fn stdcm_should_fail_if_infra_doesnt_exist(
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
        #[future] timetable: TestFixture<Timetable>,
    ) {
        let fast_rolling_stock = fast_rolling_stock.await;
        let timetable = timetable.await;
        let mut payload: Value = from_str(include_str!(
            "../../tests/small_infra/stdcm/test_1/stdcm_post_payload.json"
        ))
        .unwrap();
        *payload.get_mut("infra_id").unwrap() = json!(-999);
        *payload.get_mut("rolling_stocks").unwrap() = json!([fast_rolling_stock.id()]);
        *payload.get_mut("rolling_stock_id").unwrap() = json!(fast_rolling_stock.id());
        *payload.get_mut("timetable_id").unwrap() = json!(timetable.id());

        let app = create_test_service().await;

        let req = TestRequest::post()
            .uri("/stdcm/")
            .set_json(payload)
            .to_request();

        let service_response = call_service(&app, req).await;
        assert_eq!(service_response.status(), StatusCode::NOT_FOUND);
    }
}
