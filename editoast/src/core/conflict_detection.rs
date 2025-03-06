use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::core::{AsCoreRequest, Json};

use super::simulation::RoutingRequirement;
use super::simulation::SpacingRequirement;
use super::stdcm::WorkSchedule;

editoast_common::schemas! {
    ConflictDetectionResponse,
    ConflictRequirement,
}

#[derive(Debug, Derivative, Serialize)]
pub struct ConflictDetectionRequest {
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: String,
    /// List of requirements for each train schedule
    pub trains_requirements: HashMap<String, TrainRequirements>,
    /// List of work schedules
    pub work_schedules: Option<WorkSchedulesRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainRequirements {
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Serialize)]
pub struct WorkSchedulesRequest {
    pub start_time: DateTime<Utc>,
    pub work_schedule_requirements: HashMap<String, WorkSchedule>,
}
impl WorkSchedulesRequest {
    pub fn new(
        work_schedules: Vec<crate::models::work_schedules::WorkSchedule>,
        earliest_departure_time: DateTime<Utc>,
        latest_simulation_end: DateTime<Utc>,
    ) -> Option<Self> {
        if work_schedules.is_empty() {
            return None;
        }
        // Filter the provided work schedules to find those that conflict with the given parameters
        // This identifies any work schedules that may overlap with the earliest departure time and latest simulation end.
        let work_schedule_requirements = work_schedules
            .into_iter()
            .filter_map(|ws| {
                ws.as_core_work_schedule(earliest_departure_time, latest_simulation_end)
                    .map(|core_ws| (ws.id.to_string(), core_ws))
            })
            .collect();

        Some(Self {
            start_time: earliest_departure_time,
            work_schedule_requirements,
        })
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize))]
pub struct ConflictDetectionResponse {
    /// List of conflicts detected
    #[schema(inline)]
    pub conflicts: Vec<Conflict>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct PacedTrainOccurrenceId {
    pub paced_train_id: i64,
    pub index: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Conflict {
    /// List of train schedule ids and paced train generated occurrences involved in the conflict
    pub train_ids: Vec<String>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<String>,
    /// Datetime of the start of the conflict
    pub start_time: DateTime<Utc>,
    /// Datetime of the end of the conflict
    pub end_time: DateTime<Utc>,
    /// Type of the conflict
    #[schema(inline)]
    pub conflict_type: ConflictType,
    /// List of requirements causing the conflict
    pub requirements: Vec<ConflictRequirement>,
}

#[derive(Debug, Clone)]
pub enum TrainId {
    TrainSchedule(i64),
    PacedTrainOccurrence(PacedTrainOccurrenceId),
}

/// Unmet requirement causing a conflict.
///
/// The start and end time describe the conflicting time span (not the full
/// requirement's time span).
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ConflictRequirement {
    pub zone: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema, PartialEq)]
pub enum ConflictType {
    /// Conflict caused by two trains being too close to each other, or between a train and a work schedule
    Spacing,
    /// Conflict caused by two trains requiring incompatible routes at the same time
    Routing,
}

impl AsCoreRequest<Json<ConflictDetectionResponse>> for ConflictDetectionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/conflict_detection";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
