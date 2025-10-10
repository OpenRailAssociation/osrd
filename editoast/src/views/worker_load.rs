use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use core_client::AsCoreRequest;
use core_client::worker_load::WorkerLoadRequest;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use super::AuthenticationExt;
use crate::AppState;
use crate::error::Result;
use crate::models::Infra;
use crate::models::timetable::Timetable;
use crate::views::AuthorizationError;

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

impl From<osrdyne_client::WorkerStatus> for WorkerStatus {
    fn from(status: osrdyne_client::WorkerStatus) -> Self {
        match status {
            osrdyne_client::WorkerStatus::Unscheduled => WorkerStatus::NotReady,
            osrdyne_client::WorkerStatus::Started => WorkerStatus::Loading,
            osrdyne_client::WorkerStatus::Ready => WorkerStatus::Ready,
            osrdyne_client::WorkerStatus::Error => WorkerStatus::Error,
        }
    }
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
    FetchStatusError(#[from] osrdyne_client::Error),
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
        osrdyne_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(WorkerLoadForm {
        infra_id,
        timetable_id,
    }): Json<WorkerLoadForm>,
) -> Result<Json<WorkerStatus>> {
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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

    // Fetch status of the worker
    let worker_key = match timetable_id {
        Some(timetable_id) => format!("{infra_id}-{timetable_id}"),
        None => infra_id.to_string(),
    };
    let status = osrdyne_client
        .get_worker_status(&worker_key)
        .await
        .map_err(WorkerLoadError::FetchStatusError)?
        .into();

    if status == WorkerStatus::Error || status == WorkerStatus::NotReady {
        let infra_request = WorkerLoadRequest {
            infra: infra.id,
            expected_version: infra.version,
            timetable: timetable_id,
        };

        // Send message to load worker in background
        tokio::spawn(async move {
            let _ = infra_request.fetch(core_client.as_ref()).await;
        });
    }

    Ok(Json(status))
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_client::CoreClient;
    use core_client::mocking::MockingClient;
    use database::DbConnectionPoolV2;
    use osrdyne_client::OsrdyneClient;
    use reqwest::StatusCode;

    use crate::models::fixtures::create_empty_infra;
    use crate::views::test_app::TestAppBuilder;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn worker_load_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let osrdyne_client = OsrdyneClient::mock()
            .with_status(
                &empty_infra.id.to_string(),
                osrdyne_client::WorkerStatus::Ready,
            )
            .build();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(CoreClient::Mocked(MockingClient::default()))
            .osrdyne_client(osrdyne_client)
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
        assert_eq!(response, WorkerStatus::Ready);
    }
}
