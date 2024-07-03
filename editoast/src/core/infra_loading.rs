use serde::Serialize;

use super::AsCoreRequest;

/// A Core infra load request
#[derive(Debug, Serialize)]
pub struct InfraLoadRequest {
    pub infra: i64,
    pub expected_version: String,
}

impl AsCoreRequest<()> for InfraLoadRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/infra_load";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
