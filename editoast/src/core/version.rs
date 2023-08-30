use super::{AsCoreRequest, Json};
use crate::views::Version;
use derivative::Derivative;
use serde::Serialize;

/// A Core infra load request
#[derive(Debug, Serialize, Derivative)]
#[derivative(Default)]
pub struct CoreVersionRequest {}

impl AsCoreRequest<Json<Version>> for CoreVersionRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/version";
}
