use serde::Deserialize;
use serde::Serialize;

use crate::Json;
use crate::WorkerKey;

use super::AsCoreRequest;

/// A Core infra load request
#[derive(Debug, Serialize)]
pub struct WorkerLoadRequest {
    pub infra: i64,
    pub expected_version: i64,
    /// If provided, will load a core with this infra and this timetable loaded in cache
    pub timetable: Option<i64>,
}

/// A Core infra load response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct WorkerLoadResponse {
    pub loaded: bool,
}

impl AsCoreRequest<Json<WorkerLoadResponse>> for WorkerLoadRequest {
    const URL_PATH: &'static str = "/worker_load";
    const OVERRIDE_TIMEOUT: Option<std::time::Duration> = Some(std::time::Duration::from_secs(1));

    fn worker_key(&self) -> WorkerKey {
        match self.timetable {
            Some(timetable_id) => WorkerKey::Timetable {
                infra_id: self.infra,
                timetable_id,
            },
            None => WorkerKey::Infra(self.infra),
        }
    }
}
