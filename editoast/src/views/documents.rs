use axum::body::Bytes;
use axum::extract::Path;
use axum::extract::State;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use axum::Json;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::*;
use editoast_models::DbConnectionPoolV2;

use super::AuthenticationExt;
use super::AuthorizationError;

crate::routes! {
    "/documents" => {
        post,
        "/{document_key}" => {
            get,
            delete,
        },
    },
}

editoast_common::schemas! {
    NewDocumentResponse,
}

#[derive(Error, Debug, EditoastError)]
#[editoast_error(base_id = "document")]
pub enum DocumentErrors {
    #[error("Document '{document_key}' not found")]
    #[editoast_error(status = 404)]
    NotFound { document_key: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
}

/// Returns a document of any type
#[utoipa::path(
    get, path = "",
    tag = "documents",
    params(
        ("document_key" = i64, Path, description = "The document's key"),
    ),
    responses(
        (status = 200, description = "The document's binary content", body = [u8]),
        (status = 404, description = "Document not found", body = InternalError),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(document_id): Path<i64>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::DocumentRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    let doc = Document::retrieve_or_fail(conn, document_id, || DocumentErrors::NotFound {
        document_key: document_id,
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
#[utoipa::path(
    post, path = "",
    tag = "documents",
    params(
        ("content_type" = String, Header, description = "The document's content type"),
    ),
    request_body = [u8],
    responses(
        (status = 201, description = "The document was created", body = NewDocumentResponse),
    )
)]
async fn post(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    axum_extra::TypedHeader(content_type): axum_extra::TypedHeader<headers::ContentType>,
    bytes: Bytes,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::DocumentWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
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
#[utoipa::path(
    delete, path = "",
    tag = "documents",
    params(
        ("document_key" = i64, Path, description = "The document's key"),
    ),
    responses(
        (status = 204, description = "The document was deleted"),
        (status = 404, description = "Document not found", body = InternalError),
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(document_id): Path<i64>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::DocumentWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    Document::delete_static_or_fail(conn, document_id, || DocumentErrors::NotFound {
        document_key: document_id,
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use axum::http::header;
    use axum::http::StatusCode;
    use rstest::rstest;
    use serde::Deserialize;

    use super::*;
    use crate::views::test_app::TestAppBuilder;

    #[derive(Deserialize, Clone, Debug)]
    struct PostDocumentResponse {
        document_key: i64,
    }

    #[rstest]
    async fn document_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let request = app
            .post("/documents")
            .add_header(
                header::CONTENT_TYPE,
                header::HeaderValue::from_str("text/plain").unwrap(),
            )
            .bytes("Document post test data".into());

        // Insert document
        let response = request.await;
        response.assert_status(StatusCode::CREATED);
        let new_doc = response.json::<PostDocumentResponse>().document_key;

        // Get create document
        let document = Document::retrieve(&mut pool.get_ok(), new_doc)
            .await
            .expect("Failed to retrieve document")
            .expect("Document not found");

        assert_eq!(document.data, b"Document post test data".to_vec());
    }

    #[rstest]
    async fn get_document() {
        let app = TestAppBuilder::default_app();
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
        response.assert_status(StatusCode::OK);
        let response = response.as_bytes();

        assert_eq!(response.as_ref(), b"Document post test data");
    }

    #[rstest]
    async fn document_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Insert document test
        let document = Document::changeset()
            .data(b"Document post test data".to_vec())
            .content_type(String::from("text/plain"))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create document");

        // Delete document request
        let response = app
            .delete(format!("/documents/{}", document.id).as_str())
            .await;
        response.assert_status(StatusCode::NO_CONTENT);

        // Get create document
        let document = Document::exists(&mut pool.get_ok(), document.id)
            .await
            .expect("Failed to retrieve document");

        assert!(!document);
    }
}
