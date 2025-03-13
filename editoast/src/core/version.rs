use derivative::Derivative;
use serde::Serialize;

use super::client::AsCoreRequest;
use super::client::Json;
use crate::views::Version;

/// A Core infra load request
#[derive(Debug, Serialize, Derivative)]
#[derivative(Default)]
pub struct CoreVersionRequest {}

impl AsCoreRequest<Json<Version>> for CoreVersionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/version";

    fn infra_id(&self) -> Option<i64> {
        None
    }
}
