use axum::extract::Json;
use axum::extract::State;
use editoast_derive::EditoastError;
use editoast_schemas::rolling_stock::RollingStockComfortType;
use editoast_schemas::train_schedule::Allowance;
use editoast_schemas::train_schedule::RjsPowerRestrictionRange;
use serde_derive::Deserialize;
use serde_derive::Serialize;
use std::ops::DerefMut;
use thiserror::Error;
use utoipa::ToSchema;

use crate::core::simulation::CoreTrainSchedule;
use crate::core::simulation::SimulationRequest;
use crate::core::simulation::SimulationResponse;
use crate::core::simulation::TrainStop;
use crate::core::AsCoreRequest;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::train_schedule::ElectrificationRange;
use crate::models::train_schedule::Mrsp;
use crate::models::train_schedule::ResultTrain;
use crate::models::train_schedule::ScheduledPoint;
use crate::models::train_schedule::SimulationPowerRestrictionRange;
use crate::models::train_schedule::TrainScheduleOptions;
use crate::models::Pathfinding;
use crate::models::Retrieve;
use crate::modelsv2::electrical_profiles::ElectricalProfileSet;
use crate::modelsv2::Exists;
use crate::modelsv2::RollingStockModel;
use crate::AppState;

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
    "/single_simulation" => standalone_simulation,
}

editoast_common::schemas! {
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
    post, path = "",
    request_body = SingleSimulationRequest,
    responses(
        (status = 200, description = "Data about the simulation produced", body = SingleSimulationResponse),
    )
)]
/// Runs a simulation with a single train, does not write anything to the database
async fn standalone_simulation(
    State(AppState {
        db_pool_v2: db_pool,
        core_client: core,
        ..
    }): State<AppState>,
    Json(request): Json<SingleSimulationRequest>,
) -> Result<Json<SingleSimulationResponse>> {
    use crate::modelsv2::Retrieve;
    let mut conn = db_pool.get().await?;
    let rolling_stock_id = request.rolling_stock_id;

    let rolling_stock = RollingStockModel::retrieve_or_fail(
        db_pool.get().await?.deref_mut(),
        rolling_stock_id,
        || SingleSimulationError::RollingStockNotFound { rolling_stock_id },
    )
    .await?;

    let path_id = request.path_id;
    let pathfinding = Pathfinding::retrieve_conn(db_pool.get().await?.deref_mut(), path_id).await?;
    let pathfinding = match pathfinding {
        Some(pathfinding) => pathfinding,
        None => return Err(SingleSimulationError::PathNotFound { path_id }.into()),
    };

    if let Some(electrical_profile_set_id) = request.electrical_profile_set_id {
        let does_electrical_profile_set_exist =
            ElectricalProfileSet::exists(&mut conn, electrical_profile_set_id).await?;
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
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
