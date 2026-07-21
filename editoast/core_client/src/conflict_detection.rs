use common::units::quantities::Offset;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

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
    pub trains_requirements: HashMap<String, TrainRequirements>,
    /// List of work schedules
    pub work_schedules: Option<WorkSchedulesRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainRequirements {
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
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Serialize)]
pub struct WorkSchedulesRequest {
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
    pub train_ids: Vec<String>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<String>,
    /// Start of the conflict time range: elapsed ms since the implicit 'request base time'.
    /// This is the *union* of all the conflicting time ranges.
    ///
    /// The implicit 'request base time' is the same over the whole request
    /// (`trains_requirements` and `work_schedules`) and response.
    /// Example: `1970-01-01T00:00:00Z` for calendar timetables; the timetable start for hourly
    /// timetables.
    #[serde(with = "common::units::millisecond::i64")]
    pub start_time: Offset,
    /// Duration of the conflict in ms.
    pub duration: u64,
    /// Type of the conflict
    pub conflict_type: ConflictType,
    /// List of requirements causing the conflict
    pub requirements: Vec<ConflictRequirement>,
}

/// Unmet requirement causing a conflict.
///
/// The start time and duration describe the conflicting time span (not the full
/// requirement's time span).
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[schema(as = CoreConflictRequirement)]
pub struct ConflictRequirement {
    pub zone: String,
    /// Start of the time range during which the zone is contested: elapsed ms since the implicit
    /// 'request base time'. Earliest start time for any zone use.
    ///
    /// The implicit 'request base time' is the same over the whole request
    /// (`trains_requirements` and `work_schedules`) and response.
    /// Example: `1970-01-01T00:00:00Z` for calendar timetables; the timetable start for hourly
    /// timetables.
    #[serde(with = "common::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub start_time: Offset,
    /// Duration of the time range in ms (difference between the latest end time and the earliest start_time for any zone use in this conflict).
    pub duration: u64,
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
