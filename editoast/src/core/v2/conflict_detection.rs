use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::core::{AsCoreRequest, Json};

use super::simulation::RoutingRequirement;
use super::simulation::SpacingRequirement;

editoast_common::schemas! {
    ConflictDetectionResponse,
    Conflict,
}

#[derive(Debug, Serialize)]
pub struct ConflictDetectionRequest {
    /// List of requirements for each train
    pub trains_requirements: HashMap<i64, TrainRequirements>,
    pub infra_id: i64,
}

#[derive(Debug, Serialize)]
pub struct TrainRequirements {
    pub start_time: DateTime<Utc>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ConflictDetectionResponse {
    /// List of conflicts detected
    #[schema(inline)]
    pub conflicts: Vec<Conflict>,
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[schema(as=ConflictV2)]
pub struct Conflict {
    /// List of train ids involved in the conflict
    pub train_ids: Vec<i64>,
    /// Datetime of the start of the conflict
    pub start_time: DateTime<Utc>,
    /// Datetime of the end of the conflict
    pub end_time: DateTime<Utc>,
    /// Type of the conflict
    #[schema(inline)]
    pub conflict_type: ConflictType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub enum ConflictType {
    /// Conflict caused by two trains being too close to each other
    Spacing,
    /// Conflict caused by two trains requiring incompatible routes at the same time
    Routing,
}

impl AsCoreRequest<Json<ConflictDetectionResponse>> for ConflictDetectionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/conflict_detection";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra_id)
    }
}
