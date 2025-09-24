use serde::Serialize;

use super::AsCoreRequest;

/// A Core infra load request
#[derive(Debug, Serialize)]
pub struct WorkerLoadRequest {
    pub infra: i64,
    pub expected_version: i64,
    /// If provided, will load a core with this infra and this timetable loaded in cache
    pub timetable: Option<i64>,
}

impl AsCoreRequest<()> for WorkerLoadRequest {
    const URL_PATH: &'static str = "/worker_load";

    fn worker_id(&self) -> Option<String> {
        match self.timetable {
            Some(timetable) => Some(format!("{}-{}", self.infra, timetable)),
            None => Some(self.infra.to_string()),
        }
    }
}
