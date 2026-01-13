use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use editoast_models::CatalogEntry;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "catalog_entry")]
pub enum CatalogEntryError {
    #[error("Catalog entry '{catalog_entry_id}' could not be found")]
    #[editoast_error(status = 404)]
    NotFound { catalog_entry_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct CatalogEntryForm {
    name: Option<String>,
}

impl CatalogEntryForm {
    pub fn into_changeset(self) -> Changeset<CatalogEntry> {
        CatalogEntry::changeset().name(self.name)
    }
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct CatalogEntryIdParam {
    /// A catalog entry ID
    id: i64,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "catalog_entry",
    request_body = CatalogEntryForm,
    responses(
        (status = 201, description = "Catalog entry", body = CatalogEntry),
    ),
)]
pub(in crate::views) async fn post(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(catalog_entry_create_form): Json<CatalogEntryForm>,
) -> Result<Json<CatalogEntry>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let catalog_entry_changeset = catalog_entry_create_form.into_changeset();
    let catalog_entry = catalog_entry_changeset
        .create(&mut db_pool.get().await?)
        .await?;
    Ok(Json(catalog_entry))
}

#[derive(Serialize, ToSchema)]
pub(in crate::views) struct CatalogEntryPage {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<CatalogEntry>,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "catalog_entry",
    params(PaginationQueryParams<100>),
    responses(
        (status = 200, description = "List of catalog entries", body = inline(CatalogEntryPage)),
    ),
)]
pub(in crate::views) async fn list_paginated(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(pagination_params): Query<PaginationQueryParams<100>>,
) -> Result<Json<CatalogEntryPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    };

    let settings = pagination_params.into_selection_settings();
    let conn = &mut db_pool.get().await?;
    let (catalog_entries, stats) = CatalogEntry::list_paginated(conn, settings).await?;

    Ok(Json(CatalogEntryPage {
        results: catalog_entries,
        stats,
    }))
}

#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tag = "catalog_entry",
    params(CatalogEntryIdParam),
    request_body = CatalogEntryForm,
    responses(
        (status = 200, description = "Catalog entry", body = CatalogEntry),
        (status = 404, description = "Catalog entry not found"),
    ),
)]
pub(in crate::views) async fn put(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(CatalogEntryIdParam {
        id: catalog_entry_id,
    }): Path<CatalogEntryIdParam>,
    Json(catalog_entry_form): Json<CatalogEntryForm>,
) -> Result<Json<CatalogEntry>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let catalog_entry_changeset = catalog_entry_form.into_changeset();
    let catalog_entry = catalog_entry_changeset
        .update_or_fail(conn, catalog_entry_id, || CatalogEntryError::NotFound {
            catalog_entry_id,
        })
        .await?;
    Ok(Json(catalog_entry))
}

#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "catalog_entry",
    params(CatalogEntryIdParam),
    responses(
            (status = 204, description = "The catalog entry was deleted"),
        (status = 404, description = "Catalog entry not found"),
),
)]
pub(in crate::views) async fn delete(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(CatalogEntryIdParam {
        id: _catalog_entry_id,
    }): Path<CatalogEntryIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // TODO: Add database operation to delete a catalog entry
    Ok(StatusCode::NO_CONTENT)
}
