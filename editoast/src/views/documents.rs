use actix_http::StatusCode;
use actix_web::delete;
use actix_web::get;
use actix_web::http::header::ContentType;
use actix_web::post;
use actix_web::web::Bytes;
use actix_web::web::Data;
use actix_web::web::Header;
use actix_web::web::Path;
use actix_web::HttpResponse;
use editoast_derive::EditoastError;
use serde_derive::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;
use crate::modelsv2::*;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
    "/documents" => {
        get,
        post,
        delete,
    }
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
}

/// Returns a document of any type
#[utoipa::path(
    tag = "documents",
    params(
        ("document_key" = i64, Path, description = "The document's key"),
    ),
    responses(
        (status = 200, description = "The document's binary content", body = [u8]),
        (status = 404, description = "Document not found", body = InternalError),
    )
)]
#[get("/{document_key}")]
async fn get(db_pool: Data<DbConnectionPoolV2>, document_key: Path<i64>) -> Result<HttpResponse> {
    let document_key = document_key.into_inner();
    let conn = &mut db_pool.get().await?;
    let doc = Document::retrieve_or_fail(conn, document_key, || DocumentErrors::NotFound {
        document_key,
    })
    .await?;
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type(doc.content_type)
        .body(doc.data))
}

#[derive(Serialize, ToSchema)]
struct NewDocumentResponse {
    document_key: i64,
}

/// Post a new document (content_type by header + binary data)
#[utoipa::path(
    tag = "documents",
    params(
        ("content_type" = String, Header, description = "The document's content type"),
    ),
    request_body = [u8],
    responses(
        (status = 201, description = "The document was created", body = NewDocumentResponse),
    )
)]
#[post("")]
async fn post(
    db_pool: Data<DbConnectionPoolV2>,
    content_type: Header<ContentType>,
    bytes: Bytes,
) -> Result<HttpResponse> {
    let content_type = content_type.into_inner();
    let content_type = content_type.essence_str();

    // Create document
    let conn = &mut db_pool.get().await?;
    let doc = Document::changeset()
        .content_type(content_type.to_owned())
        .data(bytes.to_vec())
        .create(conn)
        .await?;

    // Response
    Ok(HttpResponse::Created().json(NewDocumentResponse {
        document_key: doc.id,
    }))
}

/// Delete an existing document
#[utoipa::path(
    tag = "documents",
    params(
        ("document_key" = i64, Path, description = "The document's key"),
    ),
    responses(
        (status = 204, description = "The document was deleted"),
        (status = 404, description = "Document not found", body = InternalError),
    )
)]
#[delete("/{document_key}")]
async fn delete(
    db_pool: Data<DbConnectionPoolV2>,
    document_key: Path<i64>,
) -> Result<HttpResponse> {
    let document_key = document_key.into_inner();
    let conn = &mut db_pool.get().await?;
    Document::delete_static_or_fail(conn, document_key, || DocumentErrors::NotFound {
        document_key,
    })
    .await?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg(test)]
mod tests {
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde::Deserialize;
    use std::ops::DerefMut;

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

        let request = TestRequest::post()
            .uri("/documents")
            .insert_header(ContentType::plaintext())
            .set_payload("Document post test data".as_bytes().to_vec())
            .to_request();

        // Insert document
        let new_doc = app
            .fetch(request)
            .assert_status(StatusCode::CREATED)
            .json_into::<PostDocumentResponse>()
            .document_key;

        // Get create document
        let document = Document::retrieve(pool.get_ok().deref_mut(), new_doc)
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
            .create(pool.get_ok().deref_mut())
            .await
            .expect("Failed to create document");

        // Get document test
        let request = TestRequest::get()
            .uri(&format!("/documents/{}", document.id))
            .to_request();
        let response = app.fetch(request).assert_status(StatusCode::OK).bytes();

        assert_eq!(response.to_vec(), b"Document post test data".to_vec());
    }

    #[rstest]
    async fn document_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Insert document test
        let document = Document::changeset()
            .data(b"Document post test data".to_vec())
            .content_type(String::from("text/plain"))
            .create(pool.get_ok().deref_mut())
            .await
            .expect("Failed to create document");

        // Delete document request
        let request = TestRequest::delete()
            .uri(format!("/documents/{}", document.id).as_str())
            .to_request();
        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        // Get create document
        let document = Document::exists(pool.get_ok().deref_mut(), document.id)
            .await
            .expect("Failed to retrieve document");

        assert!(!document);
    }
}
