use chrono::DateTime;
use chrono::Utc;
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
    Conflict,
    ConflictRequirement,
}

#[derive(Debug, Serialize)]
pub struct ConflictDetectionRequest {
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: String,

    /// List of requirements for each train
    pub trains_requirements: HashMap<i64, TrainRequirements>,
    /// List of work schedules
    pub work_schedules: Option<WorkSchedulesRequest>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrainRequirements {
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Serialize)]
pub struct WorkSchedulesRequest {
    pub start_time: DateTime<Utc>,
    pub work_schedule_requirements: HashMap<i64, WorkSchedule>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ConflictDetectionResponse {
    /// List of conflicts detected
    #[schema(inline)]
    pub conflicts: Vec<Conflict>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct Conflict {
    /// List of train ids involved in the conflict
    pub train_ids: Vec<i64>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<i64>,
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
