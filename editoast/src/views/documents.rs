use authz::Role;
use axum::Json;
use axum::body::Bytes;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::http::header::CONTENT_TYPE;
use axum::response::IntoResponse;
use editoast_derive::ViewError;
use serde::Serialize;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::error::Result;
use database::DbConnectionPoolV2;
use editoast_models::Document;
use editoast_models::prelude::*;

#[derive(Debug, thiserror::Error, ViewError)]
pub(in crate::views) enum DatabaseError {
    #[error("database error: {0}")]
    #[view_error(status = INTERNAL_SERVER_ERROR)]
    Internal(#[from] editoast_models::Error),
    #[error("database unavailable: {0}")]
    #[view_error(status = SERVICE_UNAVAILABLE)]
    Unavailable(#[from] database::DatabasePoolError),
}

#[derive(Debug, thiserror::Error, ViewError)]
#[error("Document '{document_key}' not found")]
#[view_error(status = NOT_FOUND, context)]
pub(in crate::views) struct DocumentNotFound {
    document_key: i64,
}

#[derive(Debug, thiserror::Error, ViewError, derive_more::From)]
pub(in crate::views) enum DocumentError {
    #[error(transparent)]
    NotFound(
        #[from]
        #[view_error]
        DocumentNotFound,
    ),
    #[error(transparent)]
    #[from(forward)]
    Database(#[view_error] DatabaseError),
}

/// Returns a document of any type
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "documents",
    params(
        ("document_key" = i64, Path, description = "The document's key"),
    ),
    responses(
        (
            status = 200,
            description = "Document content",
            content_type = "application/octet-stream",
            body = String,
        ),
        DocumentError,
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(document_id): Path<i64>,
) -> Result<impl IntoResponse, DocumentError> {
    let conn = &mut db_pool.get().await?;
    let doc = Document::retrieve_or_fail(conn.clone(), document_id, || {
        DocumentError::NotFound(DocumentNotFound {
            document_key: document_id,
        })
    })
    .await?;
    Ok((
        StatusCode::OK,
        [
            (CONTENT_TYPE, doc.content_type),
            (CACHE_CONTROL, "public, max-age=3600".to_string()),
        ],
        doc.data,
    ))
}

#[derive(Serialize, ToSchema)]
struct NewDocumentResponse {
    document_key: i64,
}

/// Post a new document (content_type by header + binary data)
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "documents",
    params(
        ("content_type" = String, Header, description = "The document's content type"),
    ),
    request_body(content_type = "application/octet-stream", content = String),
    responses(
        (status = 201, description = "The document was created", body = NewDocumentResponse),
        DatabaseError,
    )
)]
pub(in crate::views) async fn post(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    axum_extra::TypedHeader(content_type): axum_extra::TypedHeader<headers::ContentType>,
    bytes: Bytes,
) -> Result<impl IntoResponse, DatabaseError> {
    let content_type = content_type.to_string();

    // Create document
    let conn = &mut db_pool.get().await?;
    let doc = Document::changeset()
        .content_type(content_type.to_owned())
        .data(bytes.to_vec())
        .create(conn)
        .await?;

    // Response
    Ok((
        StatusCode::CREATED,
        Json(NewDocumentResponse {
            document_key: doc.id,
        }),
    ))
}

/// Delete an existing document
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "documents",
    params(
        ("document_key" = i64, Path, description = "The document's key"),
    ),
    responses(
        (status = 204, description = "The document was deleted"),
        DocumentError,
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(document_id): Path<i64>,
) -> Result<impl IntoResponse, DocumentError> {
    let conn = &mut db_pool.get().await?;
    Document::delete_static_or_fail(conn, document_id, || {
        DocumentError::NotFound(DocumentNotFound {
            document_key: document_id,
        })
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use axum::http::header;

    use serde::Deserialize;

    use super::*;
    use crate::views::test_app;

    #[derive(Deserialize, Clone, Debug)]
    struct PostDocumentResponse {
        document_key: i64,
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn document_post() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        // Insert document
        let new_doc = app
            .post("/documents")
            .add_header(
                header::CONTENT_TYPE,
                header::HeaderValue::from_str("text/plain").unwrap(),
            )
            .bytes("Document post test data".into())
            .await
            .assert_status(StatusCode::CREATED)
            .json::<PostDocumentResponse>()
            .document_key;

        // Get create document
        let document = Document::retrieve(pool.get_ok(), new_doc)
            .await
            .expect("Failed to retrieve document")
            .expect("Document not found");

        assert_eq!(document.data, b"Document post test data".to_vec());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_document() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        // Insert document test
        let document = Document::changeset()
            .data(b"Document post test data".to_vec())
            .content_type(String::from("text/plain"))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create document");

        // Get document test
        let response = app.get(&format!("/documents/{}", document.id)).await;
        response.assert_status_ok();
        let response = response.into_bytes();

        assert_eq!(response.as_ref(), b"Document post test data");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn document_delete() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        // Insert document test
        let document = Document::changeset()
            .data(b"Document post test data".to_vec())
            .content_type(String::from("text/plain"))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create document");

        // Delete document request
        app.delete(format!("/documents/{}", document.id).as_str())
            .await
            .assert_status_no_content();

        // Get create document
        let document = Document::exists(&mut pool.get_ok(), document.id)
            .await
            .expect("Failed to retrieve document");

        assert!(!document);
    }
}
