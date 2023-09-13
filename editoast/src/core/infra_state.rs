use std::collections::HashMap;

use crate::views::infra::InfraState;

use super::{AsCoreRequest, Json};
use derivative::Derivative;
use serde::Serialize;
use serde_derive::Deserialize;
use utoipa::ToSchema;

/// A Core infra load request
#[derive(Debug, Serialize, Derivative)]
#[derivative(Default)]
pub struct InfraStateRequest {
    #[derivative(Default(value = "None"))]
    pub infra: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
pub struct InfraStateResponse {
    pub last_status: Option<InfraState>,
    pub status: InfraState,
}

impl AsCoreRequest<Json<HashMap<String, InfraStateResponse>>> for InfraStateRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/cache_status";
}
