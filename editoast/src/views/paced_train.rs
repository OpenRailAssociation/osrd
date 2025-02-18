use crate::error::Result;
use crate::models::prelude::*;
use crate::views::ListId;
use axum::extract::Json;
use axum::extract::State;
use axum::{response::IntoResponse, Extension};
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::paced_train::PacedTrainBase;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::ToSchema;

use super::AuthenticationExt;
use crate::{models::paced_train::PacedTrain, views::AuthorizationError};

crate::routes! {
    "/paced_train" => {
        delete,
    },
}

editoast_common::schemas! {
    PacedTrainResult,
    PacedTrainBase,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "paced_train")]
enum PacedTrainError {
    #[error("{count} paced train(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchPacedTrainNotFound { count: usize },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct PacedTrainResult {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    paced_train: PacedTrainBase,
}

impl From<PacedTrain> for PacedTrainResult {
    fn from(value: PacedTrain) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            paced_train: value.into(),
        }
    }
}

/// Delete a paced train
#[utoipa::path(
    delete, path = "",
    tag = "timetable,paced_train",
    request_body = inline(ListId),
    responses(
        (status = 204, description = "All paced_trains have been deleted")
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(ListId {
        ids: paced_train_ids,
    }): Json<ListId>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::TimetableWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    PacedTrain::delete_batch_or_fail(conn, paced_train_ids, |count| {
        PacedTrainError::BatchPacedTrainNotFound { count }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use rstest::rstest;
    use serde_json::json;

    use crate::models::prelude::*;
    use crate::{
        models::{
            fixtures::{create_simple_paced_train, create_timetable, simple_paced_train_base},
            paced_train::PacedTrain,
        },
        views::{paced_train::PacedTrainResult, test_app::TestAppBuilder},
    };
    use axum::http::StatusCode;

    #[rstest]
    async fn paced_train_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train_base = simple_paced_train_base();

        // Insert paced_train
        let request = app
            .post(format!("/timetable/{}/paced_trains", timetable.id).as_str())
            .json(&json!(vec![paced_train_base]));

        let response: Vec<PacedTrainResult> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(response.len(), 1);
    }

    #[rstest]
    async fn paced_train_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train = create_simple_paced_train(&mut pool.get_ok(), timetable.id).await;

        let request = app
            .delete("/paced_train/")
            .json(&json!({"ids": vec![paced_train.id]}));

        let _ = app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = PacedTrain::exists(&mut pool.get_ok(), paced_train.id)
            .await
            .expect("Failed to retrieve paced_train");

        assert!(!exists);
    }
}
