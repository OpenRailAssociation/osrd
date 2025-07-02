use editoast_schemas::train_schedule::Comfort;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::AsCoreRequest;
use crate::Json;
use crate::simulation::SimpleEnvelope;
use crate::simulation::{
    PhysicsConsist, SimulationPath, SimulationPowerRestrictionItem, SimulationScheduleItem,
    SpeedLimitProperties,
};

editoast_common::schemas! {
    Response,
    ETCSCurves,
}

#[derive(Debug, Serialize)]
pub struct Request {
    pub infra: i64,
    pub expected_version: i64,
    pub physics_consist: PhysicsConsist,
    pub comfort: Comfort,
    pub path: SimulationPath,
    pub schedule: Vec<SimulationScheduleItem>,
    pub power_restrictions: Vec<SimulationPowerRestrictionItem>,
    pub electrical_profile_set_id: Option<i64>,
    pub use_electrical_profiles: bool,
    pub mrsp: SpeedLimitProperties,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
#[schema(as = ETCSBrakingCurvesResponse)]
pub struct Response {
    /// List of ETCS braking curves associated to the train schedule's ETCS slowdowns
    pub slowdowns: Vec<ETCSCurves>,
    /// List of ETCS braking curves associated to the train schedule's ETCS stops
    pub stops: Vec<ETCSCurves>,
    /// List of ETCS braking curves associated to the train schedule's ETCS signals
    pub signals: Vec<ETCSCurves>,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
pub struct ETCSCurves {
    #[schema(inline)]
    pub indication: Option<SimpleEnvelope>,
    #[schema(inline)]
    pub permitted_speed: Option<SimpleEnvelope>,
    #[schema(inline)]
    pub guidance: Option<SimpleEnvelope>,
}

impl AsCoreRequest<Json<Response>> for Request {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/etcs_braking_curves";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
