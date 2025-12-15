use database::DbConnectionPoolV2;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
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
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct CatalogEntryForm {
    name: Option<String>,
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
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
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
    // TODO: Add database operation to create a catalog entry
    let catalog_entry = CatalogEntry {
        id: 0,
        name: catalog_entry_create_form.name,
    };
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
pub(in crate::views) async fn get(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<100>>,
) -> Result<Json<CatalogEntryPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    };

    let catalog_entries = vec![
        CatalogEntry {
            id: 1,
            name: Some("Catalog Entry 1".to_string()),
        },
        CatalogEntry {
            id: 2,
            name: Some("Catalog Entry 2".to_string()),
        },
    ];

    let stats = PaginationStats {
        count: catalog_entries.len() as u64,
        page_size,
        page_count: 1,
        current: page,
        previous: None,
        next: None,
    };

    Ok(Json(CatalogEntryPage {
        results: catalog_entries,
        stats,
    }))
}

#[editoast_derive::route]
#[utoipa::path(
        get, path = "",
        tag = "catalog_entry",
        params(CatalogEntryIdParam),
    responses(
        (status = 200, description = "Catalog entry", body = CatalogEntry),
        (status = 404, description = "Catalog entry not found"),
    ),
)]
pub(in crate::views) async fn get_by_id(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(CatalogEntryIdParam {
        id: catalog_entry_id,
    }): Path<CatalogEntryIdParam>,
) -> Result<Json<CatalogEntry>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // TODO: Add database operation to get a catalog entry
    let catalog_entry_result = CatalogEntry {
        id: catalog_entry_id,
        name: Some("Catalog Entry".to_string()),
    };
    Ok(Json(catalog_entry_result))
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
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
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

    // TODO: Add database operation to update a catalog entry
    let catalog_entry = CatalogEntry {
        id: catalog_entry_id,
        name: catalog_entry_form.name,
    };
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
