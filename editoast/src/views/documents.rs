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
use crate::modelsv2::ConnectionPool;
use crate::modelsv2::*;

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
async fn get(db_pool: Data<ConnectionPool>, document_key: Path<i64>) -> Result<HttpResponse> {
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
    db_pool: Data<ConnectionPool>,
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
async fn delete(db_pool: Data<ConnectionPool>, document_key: Path<i64>) -> Result<HttpResponse> {
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
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde::Deserialize;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::document_example;
    use crate::fixtures::tests::TestFixture;
    use crate::views::tests::create_test_service;

    #[rstest]
    async fn get_document(
        #[future] document_example: TestFixture<Document>,
        db_pool: Data<ConnectionPool>,
    ) {
        let service = create_test_service().await;
        let doc = document_example.await;

        let doc_key = doc.id();
        let url = format!("/documents/{}", doc_key);

        // Should succeed
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete the document
        assert!(doc
            .model
            .delete(&mut db_pool.get().await.unwrap())
            .await
            .unwrap());

        // Should fail
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_client_error());
    }

    #[derive(Deserialize, Clone, Debug)]
    struct PostDocumentResponse {
        document_key: i64,
    }

    #[rstest]
    async fn document_post(db_pool: Data<ConnectionPool>) {
        let service = create_test_service().await;

        // Insert document
        let request = TestRequest::post()
            .uri("/documents")
            .insert_header(ContentType::plaintext())
            .set_payload("Test data".as_bytes().to_vec())
            .to_request();
        let response: PostDocumentResponse = call_and_read_body_json(&service, request).await;

        // Delete the document
        assert!(
            Document::delete_static(&mut db_pool.get().await.unwrap(), response.document_key)
                .await
                .unwrap()
        );
    }

    #[rstest]
    async fn document_delete(#[future] document_example: TestFixture<Document>) {
        let document_example = document_example.await;
        let service = create_test_service().await;
        let request = TestRequest::delete()
            .uri(format!("/documents/{}", document_example.id()).as_str())
            .to_request();
        assert!(call_service(&service, request).await.status().is_success());
    }
}
