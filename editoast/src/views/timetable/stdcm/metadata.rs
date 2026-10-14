use axum_tracing_opentelemetry::tracing_opentelemetry_instrumentation_sdk::find_current_trace_id;
use chrono::DateTime;
use chrono::Utc;
use object_store::ObjectStoreExt as _;
use object_store::aws::AmazonS3;
use object_store::path::Path as ObjectStorePath;
use serde::Serialize;

use super::VirtualTrainRun;
use super::request::StdcmPathfindingItem;
use crate::views::timetable::simulation::ResponseVariant;

/// Metadata of a STDCM request, saved in osrd s3 next to the files written by core.
/// The purpose of the generated file is to keep any data that we'd like to inspect and run statistics on.
#[derive(Debug, Serialize)]
pub(super) struct StdcmMetadata {
    pub(super) request_time: DateTime<Utc>,
    pub(super) app_version: Option<String>,
    pub(super) user_name: Option<String>,
    pub(super) roles: Vec<authz::Role>,
    pub(super) infra_id: i64,
    pub(super) timetable_id: i64,
    pub(super) is_fallback: bool,
    pub(super) steps: Vec<StdcmPathfindingItem>,
    pub(super) preprocessing: Vec<ConsistPreprocessing>,
    pub(super) earliest_departure_time: DateTime<Utc>,
    pub(super) maximum_departure_delay: u64,
    pub(super) maximum_run_time: u64,
}

#[derive(Debug, Serialize)]
pub(super) struct ConsistPreprocessing {
    pub(super) status: ResponseVariant,
    /// In mm
    pub(super) length: Option<u64>,
    /// In ms
    pub(super) run_time: Option<u64>,
}

impl From<&VirtualTrainRun> for ConsistPreprocessing {
    fn from(run: &VirtualTrainRun) -> Self {
        Self {
            status: run.simulation.clone().into(),
            length: run.path_length,
            run_time: run.simulation.simulation_run_time(),
        }
    }
}

impl StdcmMetadata {
    pub(super) async fn save(&self, s3: &AmazonS3) {
        let Some(trace_id) = find_current_trace_id() else {
            return;
        };
        let path = ObjectStorePath::from("stdcm/requests/")
            .join(trace_id.clone())
            .join("editoast_metadata.json");
        let payload = serde_json::to_vec(self).expect("failed to serialize stdcm metadata");
        if let Err(error) = s3.put(&path, payload.into()).await {
            tracing::error!(?error, %path, %trace_id, "failed to write stdcm metadata");
        }
    }
}
