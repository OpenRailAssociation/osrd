use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
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

#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Json(catalog_entry_create_form): Json<CatalogEntryForm>,
) -> Result<impl IntoResponse> {
    let catalog_entry_changeset = catalog_entry_create_form.into_changeset();
    let catalog_entry = catalog_entry_changeset
        .create(&mut db_pool.get().await?)
        .await?;
    Ok((StatusCode::CREATED, Json(catalog_entry)))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct CatalogEntryPage {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<CatalogEntry>,
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Query(pagination_params): Query<PaginationQueryParams<100>>,
) -> Result<Json<CatalogEntryPage>> {
    let settings = pagination_params.into_selection_settings();
    let conn = &mut db_pool.get().await?;
    let (catalog_entries, stats) = CatalogEntry::list_paginated(conn, settings).await?;

    Ok(Json(CatalogEntryPage {
        results: catalog_entries,
        stats,
    }))
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    Path(CatalogEntryIdParam {
        id: catalog_entry_id,
    }): Path<CatalogEntryIdParam>,
    Json(catalog_entry_form): Json<CatalogEntryForm>,
) -> Result<Json<CatalogEntry>> {
    let conn = &mut db_pool.get().await?;
    let catalog_entry_changeset = catalog_entry_form.into_changeset();
    let catalog_entry = catalog_entry_changeset
        .update_or_fail(conn, catalog_entry_id, || CatalogEntryError::NotFound {
            catalog_entry_id,
        })
        .await?;
    Ok(Json(catalog_entry))
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(CatalogEntryIdParam {
        id: catalog_entry_id,
    }): Path<CatalogEntryIdParam>,
) -> Result<impl IntoResponse> {
    CatalogEntry::delete_static_or_fail(&mut db_pool.get().await?, catalog_entry_id, || {
        CatalogEntryError::NotFound { catalog_entry_id }
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use crate::fixtures::create_catalog_entry;
    use crate::fixtures::create_catalog_entry_with_name;
    use crate::views::test_app;

    use super::*;
    use editoast_models::catalog_entry::CatalogEntry;
    use serde_json::json;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn catalog_entry_post() {
        let app = test_app!().skip_authz().build();

        let catalog_entry_form = CatalogEntryForm {
            name: Some("test".to_string()),
        };

        let request = app
            .post("/catalog_entries")
            .json(&json!(catalog_entry_form));
        let catalog_entry: CatalogEntry = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();
        assert_eq!(
            catalog_entry,
            CatalogEntry {
                id: 1,
                name: Some("test".to_string())
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn catalog_entry_get() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;

        let request = app.get("/catalog_entries");
        let catalog_entries = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<CatalogEntryPage>();
        let results = catalog_entries.results;
        assert_eq!(results.len(), 1);
        assert_eq!(results, vec![catalog_entry]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn catalog_entry_delete() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;

        let request = app.delete(format!("/catalog_entries/{}", catalog_entry.id).as_str());

        let response = app.fetch(request).await;
        response.assert_status(StatusCode::NO_CONTENT);

        let exists = CatalogEntry::exists(&mut db_pool.get_ok(), catalog_entry.id)
            .await
            .expect("Failed to check if catalog entry exists");
        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn catalog_entry_unexisting_delete() {
        let app = test_app!().skip_authz().build();

        let request = app.delete("/catalog_entries/999999");

        let response = app.fetch(request).await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn catalog_entry_put() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;

        let catalog_entry_form = CatalogEntryForm {
            name: Some("test2".to_string()),
        };

        let request = app
            .put(format!("/catalog_entries/{}", catalog_entry.id).as_str())
            .json(&json!(catalog_entry_form));
        let catalog_entry_result: CatalogEntry = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            catalog_entry_result,
            CatalogEntry {
                id: 1,
                name: Some("test2".to_string())
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn catalog_entry_list_paginated() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let catalog_entry_1 =
            create_catalog_entry_with_name(&mut db_pool.get().await.unwrap(), "test_1").await;
        let catalog_entry_2 =
            create_catalog_entry_with_name(&mut db_pool.get().await.unwrap(), "test_2").await;
        let request = app.get("/catalog_entries");
        let catalog_entries: CatalogEntryPage = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let results = catalog_entries.results;
        assert_eq!(results, vec![catalog_entry_1, catalog_entry_2]);
    }
}
