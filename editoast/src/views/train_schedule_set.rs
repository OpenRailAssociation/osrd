use database::DbConnectionPoolV2;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::train_schedule_set::TrainScheduleSet;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetResponse {
    #[serde(flatten)]
    train_schedule_set: TrainScheduleSet,
    train_schedule_count: u64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetCreateForm {
    catalogue_entry_id: Option<i64>,
    name: Option<String>,
    description: String,
    published: bool,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule_set",
    request_body = TrainScheduleSetCreateForm,
    responses(
        (status = 201, description = "Train schedule set", body = TrainScheduleSetResponse),
    ),
)]
pub(in crate::views) async fn post(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(train_schedule_set_create_form): Json<TrainScheduleSetCreateForm>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    // TODO: Add database operation to create a train schedule set
    let train_schedule_set_response = TrainScheduleSetResponse {
        train_schedule_set: TrainScheduleSet {
            id: 0,
            catalogue_entry_id: train_schedule_set_create_form.catalogue_entry_id,
            name: train_schedule_set_create_form.name,
            description: train_schedule_set_create_form.description,
            published: train_schedule_set_create_form.published,
        },
        train_schedule_count: 0,
    };

    Ok(Json(train_schedule_set_response))
}
