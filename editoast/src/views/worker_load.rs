use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use core_client::AsCoreRequest;
use core_client::Error as CoreClientError;
use core_client::mq_client::MqClientError;
use core_client::worker_load::WorkerLoadRequest;
use core_client::worker_load::WorkerLoadResponse;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use super::AuthenticationExt;
use crate::AppState;
use crate::error::Result;
use editoast_models::Infra;
use editoast_models::timetable::Timetable;

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct WorkerLoadForm {
    /// The infra id of the worker to load
    infra_id: i64,
    /// The timetable id to load, if any
    timetable_id: Option<i64>,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WorkerStatus {
    #[default]
    NotReady,
    Loading,
    Ready,
    Error,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "worker_load")]
pub enum WorkerLoadError {
    /// Couldn't find the infra with the given id
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },

    /// Couldn't find the timetable with the given id
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),

    #[error(transparent)]
    #[editoast_error(status = 500)]
    FetchStatusError(#[from] CoreClientError),
}

/// Ensure a worker for the given infra (and stdcm timetable) is ready
#[editoast_derive::route]
#[utoipa::path(
    post,
    path = "",
    tag = "worker",
    request_body = inline(WorkerLoadForm),
    responses(
        (status = 200, description = "The worker status", body = WorkerStatus),
        (status = 404, description = "The infra was not found"),
        (status = 404, description = "The timetable was not found"),
    )
)]
pub(in crate::views) async fn worker_load(
    State(AppState {
        db_pool,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(WorkerLoadForm {
        infra_id,
        timetable_id,
    }): Json<WorkerLoadForm>,
) -> Result<Json<WorkerStatus>> {
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        WorkerLoadError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Check timetable exists
    if let Some(timetable_id) = timetable_id {
        Timetable::exists_or_fail(&mut db_pool.get().await?, timetable_id, || {
            WorkerLoadError::TimetableNotFound { timetable_id }
        })
        .await?;
    }

    let infra_request = WorkerLoadRequest {
        infra: infra.id,
        expected_version: infra.version,
        timetable: timetable_id,
    };

    let status = infra_request.fetch(core_client.as_ref()).await;

    let status = match status {
        Ok(WorkerLoadResponse { loaded: true }) => WorkerStatus::Ready,
        Ok(WorkerLoadResponse { loaded: false }) => WorkerStatus::NotReady,
        Err(CoreClientError::MqClientError(MqClientError::ResponseTimeout)) => {
            // Treat timeout as NotReady
            WorkerStatus::NotReady
        }
        Err(e) => return Err(e.into()),
    };

    Ok(Json(status))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::views::test_app::TestAppBuilder;
    use core_client::CoreClient;
    use core_client::mocking::MockingClient;
    use database::DbConnectionPoolV2;
    use reqwest::StatusCode;
    use rstest::rstest;
    use serde_json::json;

    #[rstest]
    #[case(true, WorkerStatus::Ready)]
    #[case(false, WorkerStatus::NotReady)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn worker_load_test(#[case] loaded: bool, #[case] expected: WorkerStatus) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let mut core = MockingClient::default();
        core.stub("/worker_load")
            .response(StatusCode::OK)
            .json(json!({ "loaded": loaded }))
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(CoreClient::Mocked(core))
            .build();
        let req = app.post("/worker_load").json(&WorkerLoadForm {
            infra_id: empty_infra.id,
            timetable_id: None,
        });
        let response: WorkerStatus = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response, expected);
    }
}
