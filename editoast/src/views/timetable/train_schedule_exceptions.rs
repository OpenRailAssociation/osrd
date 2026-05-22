use std::collections::HashSet;
use std::sync::Arc;

use authz;
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

use crate::error::Result;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_exception")]
pub enum TrainScheduleExceptionError {
    #[error("{count} train schedule exception(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchNotFound { count: usize },
    #[error("Train schedule exception '{exception_id}' could not be found")]
    #[editoast_error(status = 404)]
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
    #[error(
        "Occurrence index '{occurrence_index}' is invalid for train schedule '{train_schedule_id}' with time window '{time_window}' and interval '{interval}'"
    )]
    #[editoast_error(status = 400)]
    InvalidOccurrenceIndex {
        train_schedule_id: i64,
        occurrence_index: i64,
        time_window: String,
        interval: String,
    },
    #[error(
        "The occurrence index '{occurrence_index}' is already used for another exception of the same train schedule"
    )]
    #[editoast_error(status = 400)]
    OccurrenceIndexAlreadyUsed { occurrence_index: String },
    #[error(transparent)]
    Database(editoast_models::Error),
}

impl From<editoast_models::Error> for TrainScheduleExceptionError {
    fn from(e: editoast_models::Error) -> Self {
        match e {
            editoast_models::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint
                == "train_schedule_exception_timetable_id_train_schedule_id_occ_key"
                && column == "timetable_id, train_schedule_id, occurrence_index" =>
            {
                Self::OccurrenceIndexAlreadyUsed {
                    occurrence_index: value,
                }
            }
            e => Self::Database(e),
        }
    }
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct TimetableIdParam {
    /// A timetable ID
    pub id: i64,
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct ExceptionIdParam {
    /// An exception ID
    pub id: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct ExceptionIdsParam {
    ids: HashSet<i64>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub(in crate::views) struct TrainScheduleExceptionForm {
    pub train_schedule_id: i64,
    pub occurrence_index: Option<i64>,
    pub disabled: bool,
    pub change_groups: TrainScheduleExceptionChangeGroups,
}

impl From<TrainScheduleExceptionForm> for TrainScheduleExceptionChangeset {
    fn from(train_schedule_exception_form: TrainScheduleExceptionForm) -> Self {
        editoast_models::TrainScheduleException::changeset()
            .train_schedule_id(train_schedule_exception_form.train_schedule_id)
            .occurrence_index(train_schedule_exception_form.occurrence_index)
            .disabled(train_schedule_exception_form.disabled)
            .change_groups(train_schedule_exception_form.change_groups)
    }
}

/// Create a train schedule exception
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(train_schedule_exception_form): Json<TrainScheduleExceptionForm>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    Timetable::exists_or_fail(conn, timetable_id, || {
        TrainScheduleExceptionError::TimetableNotFound { timetable_id }
    })
    .await?;

    let train_schedule = editoast_models::TrainSchedule::retrieve_or_fail(
        conn.clone(),
        train_schedule_exception_form.train_schedule_id,
        || TrainScheduleExceptionError::TrainScheduleNotFound {
            train_schedule_id: train_schedule_exception_form.train_schedule_id,
        },
    )
    .await?;

    if train_schedule.pace().is_none() {
        return Err(TrainScheduleExceptionError::NotPacedTrain {
            train_schedule_id: train_schedule_exception_form.train_schedule_id,
        }
        .into());
    }

    if let Some(occurrence_index) = train_schedule_exception_form.occurrence_index
        && !train_schedule.is_exception_occurrence_index_valid(occurrence_index)
    {
        return Err(TrainScheduleExceptionError::InvalidOccurrenceIndex {
            train_schedule_id: train_schedule_exception_form.train_schedule_id,
            occurrence_index,
            time_window: train_schedule
                .time_window
                .map(|t| t.to_string())
                .unwrap_or_else(|| "None".to_string()),
            interval: train_schedule
                .interval
                .map(|i| i.to_string())
                .unwrap_or_else(|| "None".to_string()),
        }
        .into());
    }

    let train_schedule_exception_changeset: TrainScheduleExceptionChangeset =
        train_schedule_exception_form.into();
    let train_schedule_exception_changeset =
        train_schedule_exception_changeset.timetable_id(timetable_id);
    let train_schedule_exception: TrainScheduleException = train_schedule_exception_changeset
        .create(conn)
        .await
        .map_err(TrainScheduleExceptionError::from)?
        .into();

    Ok(Json(train_schedule_exception))
}

/// Delete train schedule exceptions
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tags = ["train_schedule_exceptions"],
    request_body (
            content = inline(ExceptionIdsParam),
            description = "A set of train schedule exception IDs"
    ),
    responses(
        (status = 204, description = "The train schedule exception was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(ExceptionIdsParam { ids: exception_ids }): Json<ExceptionIdsParam>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    editoast_models::TrainScheduleException::delete_batch_or_fail(conn, exception_ids, |count| {
        TrainScheduleExceptionError::BatchNotFound { count }
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Update a train schedule exception
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    put, path = "",
    tags = ["train_schedule_exceptions"],
    params(ExceptionIdParam),
    request_body = inline(TrainScheduleExceptionForm),
    responses(
        (status = 204, description = "The train schedule exception has been updated")
    )
)]
pub(in crate::views) async fn update(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(ExceptionIdParam { id: exception_id }): Path<ExceptionIdParam>,
    Json(train_schedule_exception_form): Json<TrainScheduleExceptionForm>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    let train_schedule_id = train_schedule_exception_form.train_schedule_id;

    let train_schedule = editoast_models::TrainSchedule::retrieve_or_fail(
        conn.clone(),
        train_schedule_exception_form.train_schedule_id,
        || TrainScheduleExceptionError::TrainScheduleNotFound { train_schedule_id },
    )
    .await?;

    if train_schedule.pace().is_none() {
        return Err(TrainScheduleExceptionError::NotPacedTrain { train_schedule_id }.into());
    }

    if let Some(occurrence_index) = train_schedule_exception_form.occurrence_index
        && !train_schedule.is_exception_occurrence_index_valid(occurrence_index)
    {
        return Err(TrainScheduleExceptionError::InvalidOccurrenceIndex {
            train_schedule_id: train_schedule_exception_form.train_schedule_id,
            occurrence_index,
            time_window: train_schedule
                .time_window
                .map(|t| t.to_string())
                .unwrap_or_else(|| "None".to_string()),
            interval: train_schedule
                .interval
                .map(|i| i.to_string())
                .unwrap_or_else(|| "None".to_string()),
        }
        .into());
    }

    let changeset: TrainScheduleExceptionChangeset = train_schedule_exception_form.into();

    changeset
        .update_or_fail(conn, exception_id, || {
            TrainScheduleExceptionError::NotFound { exception_id }
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;
    use editoast_models;
    use editoast_models::TrainScheduleException;
    use editoast_models::prelude::Retrieve;
    use editoast_models::prelude::*;
    use editoast_models::train_schedule_exception::TrainScheduleExceptionChangeset;
    use reqwest::StatusCode;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::paced_train::StartTimeChangeGroup;
    use schemas::paced_train::TrainNameChangeGroup;
    use serde_json::json;

    use crate::error::InternalError;
    use crate::fixtures::create_timetable_with_simple_paced_train;
    use crate::fixtures::create_train_schedule_exception;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::train_schedule_exceptions::TrainScheduleExceptionForm;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_created_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let mut conn = pool.get_ok();

        let (timetable, train_schedule) = create_timetable_with_simple_paced_train(&mut conn).await;

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

        let response: schemas::TrainScheduleException = app
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_invalid_occurrence_index_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let mut conn = pool.get_ok();

        let (timetable, train_schedule) = create_timetable_with_simple_paced_train(&mut conn).await;

        let train_schedule_exception_form: TrainScheduleExceptionForm =
            TrainScheduleExceptionForm {
                train_schedule_id: train_schedule.id,
                occurrence_index: Some(100),
                disabled: false,
                change_groups: TrainScheduleExceptionChangeGroups::fixture_modified(),
            };

        // Insert train schedule exception
        let request = app
            .post(format!("/timetable/{}/train_schedule_exception", timetable.id).as_str())
            .json(&json!(&train_schedule_exception_form));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule_exception:InvalidOccurrenceIndex"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_duplicated_occurrence_index_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let mut conn = pool.get_ok();

        let (timetable, train_schedule) = create_timetable_with_simple_paced_train(&mut conn).await;

        let _train_schedule_exception_1 = create_train_schedule_exception(
            &mut pool.get_ok(),
            timetable.id,
            train_schedule.id,
            Some(0),
            None,
            None,
        )
        .await;

        let train_schedule_exception_form: TrainScheduleExceptionForm =
            TrainScheduleExceptionForm {
                train_schedule_id: train_schedule.id,
                occurrence_index: Some(0),
                disabled: false,
                change_groups: TrainScheduleExceptionChangeGroups::fixture_modified(),
            };

        // Insert train schedule exception
        let request = app
            .post(format!("/timetable/{}/train_schedule_exception", timetable.id).as_str())
            .json(&json!(&train_schedule_exception_form));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule_exception:OccurrenceIndexAlreadyUsed"
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_deleted() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let mut conn = pool.get_ok();

        let (timetable, train_schedule) = create_timetable_with_simple_paced_train(&mut conn).await;

        let payload = TrainScheduleExceptionChangeGroups {
            train_name: Some(TrainNameChangeGroup {
                value: "To be deleted".to_string(),
            }),
            ..Default::default()
        };

        let changeset: TrainScheduleExceptionChangeset = TrainScheduleException::changeset()
            .change_groups(payload)
            .train_schedule_id(train_schedule.id)
            .timetable_id(timetable.id);

        let train_schedule_exception: TrainScheduleException = changeset
            .create(&mut conn)
            .await
            .expect("Failed to create train schedule exception");

        let exists =
            TrainScheduleException::exists(&mut pool.get_ok(), train_schedule_exception.id)
                .await
                .expect("Failed to retrieve train schedule exception");
        assert!(exists);

        let request = app.post("/train_schedule_exceptions/delete").json(&json!({
            "ids": [train_schedule_exception.id]
        }));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists =
            TrainScheduleException::exists(&mut pool.get_ok(), train_schedule_exception.id)
                .await
                .expect("Failed to retrieve train schedule exception");
        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_update() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let (timetable, train_schedule) =
            create_timetable_with_simple_paced_train(&mut pool.get_ok()).await;

        let train_schedule_exception = create_train_schedule_exception(
            &mut pool.get_ok(),
            timetable.id,
            train_schedule.id,
            Some(1),
            None,
            None,
        )
        .await;

        let train_schedule_exception_form_change_groups = TrainScheduleExceptionChangeGroups {
            train_name: Some(TrainNameChangeGroup {
                value: "Modified".to_string(),
            }),
            ..Default::default()
        };

        let train_schedule_exception_form: TrainScheduleExceptionForm =
            TrainScheduleExceptionForm {
                train_schedule_id: train_schedule.id,
                occurrence_index: Some(2),
                disabled: false,
                change_groups: train_schedule_exception_form_change_groups.clone(),
            };

        // Update train schedule exception
        let request = app
            .put(format!("/train_schedule_exception/{}", train_schedule_exception.id).as_str())
            .json(&json!(&train_schedule_exception_form));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let updated_exception = editoast_models::TrainScheduleException::retrieve(
            pool.get_ok(),
            train_schedule_exception.id,
        )
        .await
        .expect("Failed to retrieve exception")
        .expect("Retrieved exception is absent");

        assert_eq!(updated_exception.occurrence_index, Some(2));
        assert_eq!(
            &updated_exception.change_groups,
            &train_schedule_exception_form_change_groups
        );
        assert_eq!(updated_exception.train_schedule_id, train_schedule.id);
        assert_eq!(updated_exception.timetable_id, timetable.id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_exception_invalid_occurrence_index_update() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let (timetable, train_schedule) =
            create_timetable_with_simple_paced_train(&mut pool.get_ok()).await;

        let train_schedule_exception = create_train_schedule_exception(
            &mut pool.get_ok(),
            timetable.id,
            train_schedule.id,
            Some(1),
            None,
            None,
        )
        .await;

        let train_schedule_exception_form_change_groups = TrainScheduleExceptionChangeGroups {
            train_name: Some(TrainNameChangeGroup {
                value: "Modified".to_string(),
            }),
            ..Default::default()
        };

        let train_schedule_exception_form: TrainScheduleExceptionForm =
            TrainScheduleExceptionForm {
                train_schedule_id: train_schedule.id,
                occurrence_index: Some(-100),
                disabled: false,
                change_groups: train_schedule_exception_form_change_groups.clone(),
            };

        // Update train schedule exception
        let request = app
            .put(format!("/train_schedule_exception/{}", train_schedule_exception.id).as_str())
            .json(&json!(&train_schedule_exception_form));

        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule_exception:InvalidOccurrenceIndex"
        )
    }
}
