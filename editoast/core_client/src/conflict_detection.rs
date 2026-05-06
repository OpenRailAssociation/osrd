use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AsCoreRequest;
use crate::Json;
use crate::WorkerKey;

use super::simulation::RoutingRequirement;
use super::simulation::SpacingRequirement;
use super::stdcm::WorkSchedule;

#[derive(Debug, Serialize)]
pub struct ConflictDetectionRequest {
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: i64,
    /// List of requirements for each train schedule
    pub trains_requirements: HashMap<Uuid, TrainRequirements>,
    /// List of work schedules
    pub work_schedules: Option<WorkSchedulesRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainRequirements {
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

// TODO: use struct in conflict detection instead of a Map<String, TrainRequirements>.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreTrainRequirementsById)]
pub struct TrainRequirementsById {
    pub train_id: String,
    /// ID that can be used to find the train in tools other than OSRD. Used in debug traces.
    pub train_name: String,
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Serialize)]
pub struct WorkSchedulesRequest {
    pub start_time: DateTime<Utc>,
    pub work_schedule_requirements: HashMap<String, WorkSchedule>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictDetectionResponse {
    /// List of conflicts detected
    pub conflicts: Vec<Conflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conflict {
    /// List of train schedule ids and paced train generated occurrences involved in the conflict
    pub train_ids: Vec<Uuid>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<String>,
    /// Datetime of the start of the conflict
    pub start_time: DateTime<Utc>,
    /// Datetime of the end of the conflict
    pub end_time: DateTime<Utc>,
    /// Type of the conflict
    pub conflict_type: ConflictType,
    /// List of requirements causing the conflict
    pub requirements: Vec<ConflictRequirement>,
}

/// Unmet requirement causing a conflict.
///
/// The start and end time describe the conflicting time span (not the full
/// requirement's time span).
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[schema(as = CoreConflictRequirement)]
pub struct ConflictRequirement {
    pub zone: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema, PartialEq)]
#[schema(as = CoreConflictType)]
pub enum ConflictType {
    /// Conflict caused by two trains being too close to each other, or between a train and a work schedule
    Spacing,
    /// Conflict caused by two trains requiring incompatible routes at the same time
    Routing,
}

impl AsCoreRequest<Json<ConflictDetectionResponse>> for ConflictDetectionRequest {
    const URL_PATH: &'static str = "/conflict_detection";

    fn worker_key(&self) -> WorkerKey {
        WorkerKey::Infra(self.infra)
    }
}
