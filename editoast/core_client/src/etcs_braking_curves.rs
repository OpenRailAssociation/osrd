use schemas::train_schedule::Comfort;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AsCoreRequest;
use crate::Json;
use crate::conflict_detection::ConflictType;
use crate::pathfinding::TrainPath;
use crate::simulation::PhysicsConsist;
use crate::simulation::SimulationPowerRestrictionItem;
use crate::simulation::SimulationScheduleItem;
use crate::simulation::SpeedLimitProperties;

#[derive(Debug, Serialize)]
pub struct Request {
    pub infra: i64,
    pub expected_version: i64,
    pub physics_consist: PhysicsConsist,
    pub comfort: Comfort,
    pub path: TrainPath,
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
    /// List of ETCS conflict braking curves associated to the train schedule's ETCS signals.
    /// For each non-route delimiter (F) signal, the associated spacing conflict curve is returned.
    /// For each route delimiter (Nf) signal, 2 sets of curves are returned, associated to the
    /// corresponding potential spacing or routing conflict.
    pub conflicts: Vec<ETCSConflictCurves>,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
pub struct ETCSCurves {
    #[schema(inline)]
    pub indication: Option<SimpleEnvelope>,
    #[schema(inline)]
    pub permitted_speed: SimpleEnvelope,
    #[schema(inline)]
    pub guidance: SimpleEnvelope,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
pub struct ETCSConflictCurves {
    #[schema(inline)]
    pub indication: SimpleEnvelope,
    #[schema(inline)]
    pub permitted_speed: SimpleEnvelope,
    #[schema(inline)]
    pub guidance: SimpleEnvelope,
    #[schema(inline)]
    pub conflict_type: ConflictType,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
pub struct SimpleEnvelope {
    /// List of positions of a train
    /// Both positions (in mm) and times (in ms) must have the same length
    pub positions: Vec<u64>,
    /// List of times (in ms) associated to a position
    pub times: Vec<u64>,
    /// List of speeds (in m/s) associated to a position
    pub speeds: Vec<f64>,
}

impl AsCoreRequest<Json<Response>> for Request {
    const URL_PATH: &'static str = "/etcs_braking_curves";

    fn worker_id(&self) -> Option<String> {
        Some(self.infra.to_string())
    }
}
