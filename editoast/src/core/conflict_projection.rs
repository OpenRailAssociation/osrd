use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::pathfinding::TrackRange;
use crate::core::{AsCoreRequest, Json};

editoast_common::schemas! {
    ConflictProjectionResponse,
}

#[derive(Debug, Serialize)]
pub struct ConflictProjectionRequest {
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: String,

    pub path_track_ranges: Vec<TrackRange>,
    pub zones: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ConflictProjectionResponse {
    #[schema(inline)]
    pub path_position_ranges: Vec<(u64, u64)>,
}

impl AsCoreRequest<Json<ConflictProjectionResponse>> for ConflictProjectionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/conflict_projection";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
