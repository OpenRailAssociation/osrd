use axum::extract::Query;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use thiserror::Error;
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

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_set")]
pub enum TrainScheduleSetError {
    #[error("Train schedule set '{train_schedule_set_id}' could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_set_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetResponse {
    #[serde(flatten)]
    train_schedule_set: TrainScheduleSet,
    train_schedule_count: u64,
}

impl TrainScheduleSetResponse {
    pub async fn try_fetch(
        conn: &mut DbConnection,
        published: Option<bool>,
        catalog_entry_id: Option<i64>,
    ) -> Result<Vec<Self>> {
        let mut settings = SelectionSettings::new();

        if let Some(catalog_entry_id) = catalog_entry_id {
            settings = settings
                .filter(move || TrainScheduleSet::CATALOG_ENTRY_ID.eq(Some(catalog_entry_id)));
        }

        if let Some(published) = published {
            settings = settings.filter(move || TrainScheduleSet::PUBLISHED.eq(published));
        }

        let train_schedule_sets = TrainScheduleSet::list(conn, settings).await?;
        Ok(train_schedule_sets
            .into_iter()
            .map(|train_schedule_set| Self {
                train_schedule_set,
                // TODO: Add database operation to get train schedule set count
                // once paced trains and train schedules are merged
                train_schedule_count: 0,
            })
            .collect())
    }
}
#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetForm {
    catalog_entry_id: Option<i64>,
    name: Option<String>,
    description: String,
    published: bool,
}

impl TrainScheduleSetForm {
    pub fn into_changeset(self) -> Changeset<TrainScheduleSet> {
        TrainScheduleSet::changeset()
            .catalog_entry_id(self.catalog_entry_id)
            .name(self.name)
            .description(self.description)
            .published(self.published)
    }
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
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

    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_create_form.into_changeset();
    let train_schedule_set = changeset.create(conn).await?;

    Ok(Json(TrainScheduleSetResponse {
        train_schedule_set,
        // TODO: Add database operation to get train schedule set count
        // once paced trains and train schedules are merged
        train_schedule_count: 0,
    }))
}

#[derive(IntoParams, Serialize, Deserialize, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct TrainScheduleSetQueryParams {
    catalog_entry_id: Option<i64>,
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
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

    let train_schedule_set =
        TrainScheduleSet::retrieve_or_fail(db_pool.get().await?, train_schedule_set_id, || {
            TrainScheduleSetError::NotFound {
                train_schedule_set_id,
            }
        })
        .await?;
    Ok(Json(TrainScheduleSetResponse {
        train_schedule_set,
        // TODO: Add database operation to get train schedule set count
        // once paced trains and train schedules are merged
        train_schedule_count: 0,
    }))
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(TrainScheduleSetQueryParams {
        catalog_entry_id,
        published,
    }): Query<TrainScheduleSetQueryParams>,
) -> Result<Json<Vec<TrainScheduleSetResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let train_schedule_sets =
        TrainScheduleSetResponse::try_fetch(conn, published, catalog_entry_id).await?;
    Ok(Json(train_schedule_sets))
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
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

    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_form.into_changeset();
    let train_schedule_set = changeset
        .update_or_fail(conn, train_schedule_set_id, || {
            TrainScheduleSetError::NotFound {
                train_schedule_set_id,
            }
        })
        .await?;
    let train_schedule_set_response = TrainScheduleSetResponse {
        train_schedule_set,
        // TODO: Add database operation to get train schedule set count
        // once paced trains and train schedules are merged
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
