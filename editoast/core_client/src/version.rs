use common::Version;
use serde::Serialize;

use super::AsCoreRequest;
use super::Json;

/// A Core infra load request
#[derive(Debug, Serialize, Default)]
pub struct CoreVersionRequest {}

impl AsCoreRequest<Json<Version>> for CoreVersionRequest {
    const URL_PATH: &'static str = "/version";

    fn worker_id(&self) -> Option<String> {
        None
    }
}
