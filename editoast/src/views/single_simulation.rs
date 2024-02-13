use crate::core::simulation::{
    CoreTrainSchedule, SimulationRequest, SimulationResponse, TrainStop,
};
use crate::core::{AsCoreRequest, CoreClient};
use crate::error::{InternalError, Result};
use crate::models::train_schedule::{
    Allowance, ElectrificationRange, Mrsp, ResultTrain, RjsPowerRestrictionRange, ScheduledPoint,
    SimulationPowerRestrictionRange, TrainScheduleOptions,
};
use crate::models::{Pathfinding, Retrieve};
use crate::modelsv2::electrical_profiles::ElectricalProfileSet;
use crate::modelsv2::{Exists, RollingStockModel};
use crate::schema::rolling_stock::RollingStockComfortType;
use crate::{schemas, DbPool};
use actix_web::post;
use actix_web::web::{Data, Json};
use editoast_derive::EditoastError;
use serde_derive::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::ToSchema;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "single_simulation")]
pub enum SingleSimulationError {
    #[error("Rolling Stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 400)]
    RollingStockNotFound { rolling_stock_id: i64 },
    #[error("Path '{path_id}', could not be found")]
    #[editoast_error(status = 400)]
    PathNotFound { path_id: i64 },
    #[error("Electrical Profile Set '{electrical_profile_set_id}', could not be found")]
    #[editoast_error(status = 400)]
    ElectricalProfileSetNotFound { electrical_profile_set_id: i64 },
    #[error("Received wrong response format from core")]
    #[editoast_error(status = 500)]
    WrongCoreResponseFormat,
}

crate::routes! {
    "/single_simulation" => {
        standalone_simulation,
    }
}

schemas! {
    SingleSimulationResponse,
    SingleSimulationRequest,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ScheduleArgs {
    #[serde(default)]
    pub initial_speed: f64,
    #[serde(default)]
    pub scheduled_points: Vec<ScheduledPoint>,
    #[serde(default)]
    pub allowances: Vec<Allowance>,
    #[serde(default)]
    pub stops: Vec<TrainStop>,
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default)]
    pub comfort: RollingStockComfortType,
    #[serde(default)]
    pub power_restriction_ranges: Option<Vec<RjsPowerRestrictionRange>>,
    #[serde(default)]
    pub options: Option<TrainScheduleOptions>,
}

impl ScheduleArgs {
    fn build_core_schedule(self, rolling_stock_name: String) -> CoreTrainSchedule {
        CoreTrainSchedule {
            train_name: "single".into(),
            rolling_stock: rolling_stock_name,
            initial_speed: self.initial_speed,
            scheduled_points: self.scheduled_points,
            allowances: self.allowances,
            stops: self.stops,
            tag: self.tag,
            comfort: self.comfort,
            power_restriction_ranges: self.power_restriction_ranges,
            options: self.options,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct SingleSimulationRequest {
    pub rolling_stock_id: i64,
    pub path_id: i64,
    #[serde(default)]
    pub electrical_profile_set_id: Option<i64>,
    #[serde(flatten)]
    #[schema(inline)]
    pub schedule_args: ScheduleArgs,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
struct SingleSimulationResponse {
    pub base_simulation: ResultTrain,
    pub eco_simulation: Option<ResultTrain>,
    pub speed_limits: Mrsp,
    pub warnings: Vec<String>,
    pub electrification_ranges: Vec<ElectrificationRange>,
    pub power_restriction_ranges: Vec<SimulationPowerRestrictionRange>,
}

fn get_first_from_core_vec<T>(core_vec: Vec<T>) -> Result<T> {
    core_vec
        .into_iter()
        .next()
        .ok_or(SingleSimulationError::WrongCoreResponseFormat.into())
}

impl TryFrom<SimulationResponse> for SingleSimulationResponse {
    type Error = InternalError;

    fn try_from(sim: SimulationResponse) -> Result<Self> {
        if sim.len() != 1 {
            return Err(SingleSimulationError::WrongCoreResponseFormat.into());
        }
        Ok(Self {
            base_simulation: get_first_from_core_vec(sim.base_simulations)?,
            eco_simulation: get_first_from_core_vec(sim.eco_simulations)?,
            speed_limits: get_first_from_core_vec(sim.speed_limits)?,
            warnings: sim.warnings,
            electrification_ranges: get_first_from_core_vec(sim.electrification_ranges)?,
            power_restriction_ranges: get_first_from_core_vec(sim.power_restriction_ranges)?,
        })
    }
}

#[utoipa::path(
    request_body = SingleSimulationRequest,
    responses(
        (status = 200, description = "Data about the simulation produced", body = SingleSimulationResponse),
    )
)]
#[post("")]
/// Runs a simulation with a single train, does not write anything to the database
async fn standalone_simulation(
    db_pool: Data<DbPool>,
    request: Json<SingleSimulationRequest>,
    core: Data<CoreClient>,
) -> Result<Json<SingleSimulationResponse>> {
    use crate::modelsv2::Retrieve;
    let mut db_conn = db_pool.get().await?;
    let request = request.into_inner();
    let rolling_stock_id = request.rolling_stock_id;

    let rolling_stock = RollingStockModel::retrieve_or_fail(&mut db_conn, rolling_stock_id, || {
        SingleSimulationError::RollingStockNotFound { rolling_stock_id }
    })
    .await?;

    let path_id = request.path_id;
    let pathfinding = Pathfinding::retrieve(db_pool.clone(), path_id).await?;
    let pathfinding = match pathfinding {
        Some(pathfinding) => pathfinding,
        None => return Err(SingleSimulationError::PathNotFound { path_id }.into()),
    };

    if let Some(electrical_profile_set_id) = request.electrical_profile_set_id {
        let conn = &mut db_pool.get().await?;
        let does_electrical_profile_set_exist =
            ElectricalProfileSet::exists(conn, electrical_profile_set_id).await?;
        if !does_electrical_profile_set_exist {
            return Err(SingleSimulationError::ElectricalProfileSetNotFound {
                electrical_profile_set_id,
            }
            .into());
        }
    }

    let rs_name = rolling_stock.name.clone();
    let request_payload = SimulationRequest {
        infra: pathfinding.infra_id,
        rolling_stocks: vec![rolling_stock.into()],
        train_schedules: vec![request.schedule_args.build_core_schedule(rs_name)],
        electrical_profile_set: request.electrical_profile_set_id.map(|id| id.to_string()),
        trains_path: pathfinding.into(),
    };
    let core_response = request_payload.fetch(&core).await?;
    Ok(Json(core_response.try_into()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::core::mocking::MockingClient;
    use crate::fixtures::tests::{
        db_pool, electrical_profile_set, named_fast_rolling_stock, pathfinding,
    };
    use crate::views::tests::create_test_service_with_core_client;
    use crate::{assert_response_error_type_match, assert_status_and_read};
    use actix_web::test::{call_service, TestRequest};
    use pretty_assertions::assert_eq;
    use reqwest::{Method, StatusCode};
    use rstest::rstest;
    use serde_json::json;

    fn create_core_client() -> (MockingClient, SimulationResponse) {
        let mut core_client = MockingClient::new();
        let mock_response = SimulationResponse {
            base_simulations: vec![Default::default()],
            eco_simulations: vec![Default::default()],
            speed_limits: vec![Default::default()],
            warnings: vec![],
            electrification_ranges: vec![Default::default()],
            power_restriction_ranges: vec![Default::default()],
        };
        core_client
            .stub("/standalone_simulation")
            .method(Method::POST)
            .response(StatusCode::OK)
            .body(serde_json::to_string(&mock_response).unwrap())
            .finish();
        (core_client, mock_response)
    }

    #[rstest]
    #[case::normal(None, "case_1")]
    #[case::invalid_rs_id(Some(SingleSimulationError::RollingStockNotFound { rolling_stock_id: -666 }), "case_2")]
    #[case::invalid_path_id(Some(SingleSimulationError::PathNotFound { path_id: -666 }), "case_3")]
    #[case::invalid_ep_set_id(Some(SingleSimulationError::ElectricalProfileSetNotFound { electrical_profile_set_id: -666 }), "case_4")]
    async fn test_single_simulation(
        db_pool: Data<DbPool>,
        #[case] expected_error: Option<SingleSimulationError>,
        #[case] case_id: &str,
    ) {
        // GIVEN
        let (core_client, mock_response) = create_core_client();
        let app = create_test_service_with_core_client(core_client).await;

        let mut _pf = None;
        let pf_id = match expected_error {
            Some(SingleSimulationError::PathNotFound { path_id }) => path_id,
            _ => {
                _pf = Some(pathfinding(db_pool.clone()).await);
                _pf.as_ref().unwrap().id()
            }
        };

        let mut _rs = None;
        let rs_id = match expected_error {
            Some(SingleSimulationError::RollingStockNotFound { rolling_stock_id }) => {
                rolling_stock_id
            }
            _ => {
                let mut rs_name = "fast_rolling_stock_infra_get_voltages_".to_string();
                rs_name.push_str(case_id);
                _rs = Some(named_fast_rolling_stock(&rs_name, db_pool.clone()).await);
                _rs.as_ref().unwrap().id()
            }
        };

        let mut _ep_set = None;
        let ep_set_id = match expected_error {
            Some(SingleSimulationError::ElectricalProfileSetNotFound {
                electrical_profile_set_id,
            }) => electrical_profile_set_id,
            _ => {
                _ep_set = Some(electrical_profile_set(db_pool.clone()).await);
                _ep_set.as_ref().unwrap().id()
            }
        };

        let request_body = SingleSimulationRequest {
            rolling_stock_id: rs_id,
            electrical_profile_set_id: Some(ep_set_id),
            path_id: pf_id,
            schedule_args: ScheduleArgs {
                initial_speed: 0.0,
                scheduled_points: vec![],
                allowances: vec![],
                stops: vec![],
                tag: None,
                comfort: RollingStockComfortType::Standard,
                power_restriction_ranges: None,
                options: None,
            },
        };
        let request = TestRequest::post()
            .uri("/single_simulation")
            .set_json(&request_body)
            .to_request();

        // WHEN
        let response = call_service(&app, request).await;

        // THEN
        if let Some(expected_error) = expected_error {
            assert_response_error_type_match!(response, expected_error);
        } else {
            let response_body: SingleSimulationResponse =
                assert_status_and_read!(response, StatusCode::OK);
            assert_eq!(response_body, mock_response.try_into().unwrap());
        }
    }

    #[rstest]
    async fn test_single_simulation_bare_minimum_payload(db_pool: Data<DbPool>) {
        // GIVEN
        let (core_client, mock_response) = create_core_client();
        let app = create_test_service_with_core_client(core_client).await;

        let pf = pathfinding(db_pool.clone()).await;
        let rs = named_fast_rolling_stock(
            "fast_rolling_stock_test_single_simulation_bare_minimum_payload",
            db_pool.clone(),
        )
        .await;

        let request_body: serde_json::Value = json!({
            "rolling_stock_id": rs.id(),
            "path_id": pf.id(),
        });
        let request = TestRequest::post()
            .uri("/single_simulation")
            .set_json(&request_body)
            .to_request();

        // WHEN
        let response = call_service(&app, request).await;

        // THEN
        let response_body: SingleSimulationResponse =
            assert_status_and_read!(response, StatusCode::OK);
        assert_eq!(response_body, mock_response.try_into().unwrap());
    }
}
