use super::AsCoreRequest;
use serde::Serialize;

/// A Core infra load request
#[derive(Debug, Serialize)]
pub struct InfraLoadRequest {
    pub infra: i64,
    pub expected_version: String,
}

impl AsCoreRequest<()> for InfraLoadRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/infra_load";
}
