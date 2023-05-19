use std::collections::HashMap;

use super::{AsCoreRequest, Json};
use derivative::Derivative;
use serde::Serialize;
use serde_derive::Deserialize;

/// A Core infra load request
#[derive(Debug, Serialize, Derivative)]
#[derivative(Default)]
pub struct InfraStateRequest {
    #[derivative(Default(value = "None"))]
    pub infra: Option<i64>,
}

#[derive(Debug, Clone, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct InfraStateResponse {
    pub last_status: String,
    pub status: String,
}

impl AsCoreRequest<Json<HashMap<String, InfraStateResponse>>> for InfraStateRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/cache_status";
}
