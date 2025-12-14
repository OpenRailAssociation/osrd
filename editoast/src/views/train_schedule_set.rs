use axum::extract::Query;
use database::DbConnectionPoolV2;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::train_schedule_set::TrainScheduleSet;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
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
pub(in crate::views) struct TrainScheduleSetForm {
    catalogue_entry_id: Option<i64>,
    name: Option<String>,
    description: String,
    published: bool,
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct TrainScheduleSetIdParam {
    /// A train schedule set ID
    id: i64,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule_set",
    request_body = TrainScheduleSetForm,
    responses(
        (status = 201, description = "Train schedule set", body = TrainScheduleSetResponse),
    ),
)]
pub(in crate::views) async fn post(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(train_schedule_set_create_form): Json<TrainScheduleSetForm>,
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

#[derive(IntoParams, Serialize, Deserialize, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct TrainScheduleSetQueryParams {
    catalogue_entry_id: Option<i64>,
    published: Option<bool>,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    responses(
        (status = 200, description = "Train schedule set", body = TrainScheduleSetResponse),
        (status = 404, description = "Train schedule set not found"),
    ),
)]
pub(in crate::views) async fn get_by_id(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // TODO: Add database operation to get a train schedule set
    let train_schedule_set_response = TrainScheduleSetResponse {
        train_schedule_set: TrainScheduleSet {
            id: train_schedule_set_id,
            catalogue_entry_id: None,
            name: None,
            description: String::new(),
            published: false,
        },
        train_schedule_count: 0,
    };
    Ok(Json(train_schedule_set_response))
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetQueryParams),
    responses(
        (status = 200, description = "list of train schedule sets", body = inline(Vec<TrainScheduleSetResponse>)),
    ),
)]
pub(in crate::views) async fn get(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(TrainScheduleSetQueryParams {
        catalogue_entry_id: _,
        published: _,
    }): Query<TrainScheduleSetQueryParams>,
) -> Result<Json<Vec<TrainScheduleSetResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    Ok(Json(vec![TrainScheduleSetResponse {
        train_schedule_set: TrainScheduleSet {
            id: 0,
            catalogue_entry_id: None,
            name: Some("to_be_implemented".to_string()),
            description: "to_be_implemented".to_string(),
            published: false,
        },
        train_schedule_count: 0,
    }]))
}

#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    request_body = TrainScheduleSetForm,
    responses(
        (status = 200, description = "Train schedule set", body = TrainScheduleSetResponse),
        (status = 404, description = "Train schedule set not found"),
    ),
)]
pub(in crate::views) async fn put(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
    Json(train_schedule_set_form): Json<TrainScheduleSetForm>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // TODO: Add database operation to update a train schedule set
    let train_schedule_set_response = TrainScheduleSetResponse {
        train_schedule_set: TrainScheduleSet {
            id: train_schedule_set_id,
            catalogue_entry_id: train_schedule_set_form.catalogue_entry_id,
            name: train_schedule_set_form.name,
            description: train_schedule_set_form.description,
            published: train_schedule_set_form.published,
        },
        train_schedule_count: 0,
    };
    Ok(Json(train_schedule_set_response))
}

#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
        tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    responses(
        (status = 204, description = "the train schedule set is deleted"),
        (status = 404, description = "Train schedule set not found"),
    ),
)]
pub(in crate::views) async fn delete(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: _train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    Ok(StatusCode::NO_CONTENT)
}
