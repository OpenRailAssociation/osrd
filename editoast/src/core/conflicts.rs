use serde::{Deserialize, Serialize};

use super::{AsCoreRequest, Json};
use crate::models::SpacingRequirement;
use crate::views::timetable::ConflictType;

#[derive(Debug, Serialize)]
pub struct ConflicDetectionRequest {
    pub trains_requirements: Vec<TrainRequirement>,
}

#[derive(Debug, Serialize)]
pub struct TrainRequirement {
    pub train_id: i64,
    pub spacing_requirements: Vec<SpacingRequirement>,
}

#[derive(Debug, Deserialize)]
pub struct ConflictDetectionResponse {
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
