use editoast_common::Version;
use serde::Serialize;

use super::AsCoreRequest;
use super::Json;

/// A Core infra load request
#[derive(Debug, Serialize, Default)]
pub struct CoreVersionRequest {}

impl AsCoreRequest<Json<Version>> for CoreVersionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/version";

    fn infra_id(&self) -> Option<i64> {
        None
    }
}
