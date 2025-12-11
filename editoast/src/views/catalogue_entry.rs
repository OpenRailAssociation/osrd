use database::DbConnectionPoolV2;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::catalogue_entry::CatalogueEntry;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Query;
use axum::extract::State;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct CatalogueEntryCreateForm {
    name: Option<String>,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "catalogue_entry",
    request_body = CatalogueEntryCreateForm,
    responses(
        (status = 201, description = "Catalogue entry", body = CatalogueEntry),
    ),
)]
pub(in crate::views) async fn post(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(catalogue_entry_create_form): Json<CatalogueEntryCreateForm>,
) -> Result<Json<CatalogueEntry>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    // TODO: Add database operation to create a catalogue entry
    let catalogue_entry = CatalogueEntry {
        id: 0,
        name: catalogue_entry_create_form.name,
    };
    Ok(Json(catalogue_entry))
}

#[derive(Serialize, ToSchema)]
pub(in crate::views) struct CatalogueEntryPage {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<CatalogueEntry>,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "catalogue_entry",
    params(PaginationQueryParams<100>),
    responses(
        (status = 200, description = "List of catalogue entries", body = inline(CatalogueEntryPage)),
    ),
)]
pub(in crate::views) async fn get(
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<100>>,
) -> Result<Json<CatalogueEntryPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let catalogue_entries = vec![
        CatalogueEntry {
            id: 1,
            name: Some("Catalogue Entry 1".to_string()),
        },
        CatalogueEntry {
            id: 2,
            name: Some("Catalogue Entry 2".to_string()),
        },
    ];

    let stats = PaginationStats {
        count: catalogue_entries.len() as u64,
        page_size,
        page_count: 1,
        current: page,
        previous: None,
        next: None,
    };

    Ok(Json(CatalogueEntryPage {
        results: catalogue_entries,
        stats,
    }))
}
