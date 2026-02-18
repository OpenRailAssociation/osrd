use std::sync::Arc;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use editoast_models::timetable::Timetable;
use editoast_models::train_schedule_exception::TrainScheduleExceptionChangeset;
use schemas::TrainScheduleException;
use schemas::TrainScheduleExceptionChangeGroups;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AuthenticationExt;
use crate::error::Result;
use crate::models;
use crate::views::AuthorizationError;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_exception")]
pub enum TrainScheduleExceptionError {
    #[error("Train schedule exception ’{exception_id}’ could not be found")]
    NotFound { exception_id: i64 },
    #[error("Timetable '{timetable_id}' not found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Train schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 404)]
    TrainScheduleNotFound { train_schedule_id: i64 },
    #[error("Train schedule '{train_schedule_id}' is not a paced train")]
    #[editoast_error(status = 400)]
    NotPacedTrain { train_schedule_id: i64 },
    #[error(transparent)]
    Database(#[from] editoast_models::Error),
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct TimetableIdParam {
    /// A timetable ID
    pub id: i64,
}
#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct TrainScheduleExceptionIdParam {
    /// A train schedule exception ID
    pub id: i64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub(in crate::views) struct TrainScheduleExceptionForm {
    pub train_schedule_id: i64,
    pub occurrence_index: Option<i64>,
    pub disabled: bool,
    pub change_groups: TrainScheduleExceptionChangeGroups,
}

/// Create a train schedule exception
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tags = ["train_schedule_exceptions"],
    params(TimetableIdParam),
    request_body = inline(TrainScheduleExceptionForm),
    responses(
        (status = 200, description = "The train schedule exception has been created", body = TrainScheduleException)
    )
)]
pub(in crate::views) async fn create_train_schedule_exception(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(train_schedule_exception_form): Json<TrainScheduleExceptionForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    Timetable::exists_or_fail(conn, timetable_id, || {
        TrainScheduleExceptionError::TimetableNotFound { timetable_id }
    })
    .await?;

    let train_schedule = models::TrainSchedule::retrieve_or_fail(
        conn.clone(),
        train_schedule_exception_form.train_schedule_id,
        || TrainScheduleExceptionError::TrainScheduleNotFound {
            train_schedule_id: train_schedule_exception_form.train_schedule_id,
        },
    )
    .await?;

    if !train_schedule.is_paced() {
        return Err(TrainScheduleExceptionError::NotPacedTrain {
            train_schedule_id: train_schedule_exception_form.train_schedule_id,
        }
        .into());
    }

    let train_schedule_exception_changeset: TrainScheduleExceptionChangeset =
        editoast_models::TrainScheduleException::changeset()
            .train_schedule_id(train_schedule_exception_form.train_schedule_id)
            .timetable_id(timetable_id)
            .occurrence_index(train_schedule_exception_form.occurrence_index)
            .disabled(train_schedule_exception_form.disabled)
            .change_groups(train_schedule_exception_form.change_groups);

    let train_schedule_exception: TrainScheduleException = train_schedule_exception_changeset
        .create(conn)
        .await?
        .into();

    Ok(Json(train_schedule_exception))
}

/// Delete a train schedule exception
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tags = ["train_schedule_exceptions"],
    params(TrainScheduleExceptionIdParam),
    responses(
        (status = 204, description = "The train schedule exception was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleExceptionIdParam { id: exception_id }): Path<TrainScheduleExceptionIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    editoast_models::TrainScheduleException::delete_static_or_fail(conn, exception_id, || {
        TrainScheduleExceptionError::NotFound { exception_id }
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;
    use reqwest::StatusCode;
    use schemas::TrainScheduleException;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::paced_train::StartTimeChangeGroup;
    use schemas::paced_train::TrainNameChangeGroup;
    use serde_json::json;

    use crate::models::fixtures::create_simple_paced_train;
    use crate::models::fixtures::create_timetable_with_train_schedule_set;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::train_schedule_exceptions::TrainScheduleExceptionForm;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_created_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule =
            create_simple_paced_train(&mut pool.get_ok(), train_schedule_set.id).await;

        let train_schedule_exception_form_change_groups = TrainScheduleExceptionChangeGroups {
            train_name: Some(TrainNameChangeGroup {
                value: "Created".to_string(),
            }),
            start_time: Some(StartTimeChangeGroup {
                value: DateTime::from_timestamp(0, 0).unwrap(),
            }),
            ..Default::default()
        };

        let train_schedule_exception_form: TrainScheduleExceptionForm =
            TrainScheduleExceptionForm {
                train_schedule_id: train_schedule.id,
                occurrence_index: None,
                disabled: false,
                change_groups: train_schedule_exception_form_change_groups.clone(),
            };

        // Insert train schedule exception
        let request = app
            .post(format!("/timetable/{}/train_schedule_exception", timetable.id).as_str())
            .json(&json!(&train_schedule_exception_form));

        let response: TrainScheduleException = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.occurrence_index, None);
        assert_eq!(
            &response.change_groups,
            &train_schedule_exception_form_change_groups
        );
        assert_eq!(response.train_schedule_id, train_schedule.id);
        assert_eq!(response.timetable_id, timetable.id);
    }
}
