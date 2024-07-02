use serde::Deserialize;
use serde::Serialize;

use super::v2::conflict_detection::ConflictType;
use super::AsCoreRequest;
use super::Json;
use crate::models::RoutingRequirement;
use crate::models::SpacingRequirement;

#[derive(Debug, Serialize)]
pub struct ConflicDetectionRequest {
    pub trains_requirements: Vec<TrainRequirements>,
}

#[derive(Debug, Serialize)]
pub struct TrainRequirements {
    pub train_id: i64,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Deserialize)]
pub struct ConflictDetectionResponse {
    // TODO: Warnings should be forward to the client (for debugging purposes)
    #[allow(dead_code)]
    pub warnings: Vec<String>,
    pub conflicts: Vec<CoreConflict>,
}

#[derive(Debug, Deserialize)]
pub struct CoreConflict {
    pub train_ids: Vec<i64>,
    pub start_time: f64,
    pub end_time: f64,
    pub conflict_type: ConflictType,
}

impl AsCoreRequest<Json<ConflictDetectionResponse>> for ConflicDetectionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/detect_conflicts";
}
