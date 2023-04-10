use crate::error::Result;
use crate::models::{Create, Delete, Document, Retrieve};
use crate::DbPool;
use actix_http::StatusCode;
use actix_web::dev::HttpServiceFactory;
use actix_web::http::header::ContentType;
use actix_web::web::{scope, Bytes, Data, Header, Path};
use actix_web::{delete, get, post, HttpResponse};
use editoast_derive::EditoastError;
use serde_json::json;
use thiserror::Error;

pub fn routes() -> impl HttpServiceFactory {
    scope("/documents").service((get, post, delete))
}

#[derive(Error, Debug, EditoastError)]
#[editoast_error(base_id = "document")]
pub enum DocumentErrors {
    #[error("Document '{document_key}' not found")]
    #[editoast_error(status = 404)]
    NotFound { document_key: i64 },
}

#[get("/{document_key}")]
async fn get(db_pool: Data<DbPool>, document_key: Path<i64>) -> Result<HttpResponse> {
    let document_key = document_key.into_inner();
    let doc = match Document::retrieve(db_pool, document_key).await? {
        Some(doc) => doc,
        None => return Err(DocumentErrors::NotFound { document_key }.into()),
    };
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type(doc.content_type.unwrap())
        .body(doc.data.unwrap()))
}

#[post("")]
async fn post(
    db_pool: Data<DbPool>,
    content_type: Header<ContentType>,
    bytes: Bytes,
) -> Result<HttpResponse> {
    let content_type = content_type.into_inner();
    let content_type = content_type.essence_str();

    // Create document
    let doc = Document::new(content_type.to_string(), bytes.to_vec())
        .create(db_pool)
        .await?;

    // Response
    Ok(HttpResponse::build(StatusCode::CREATED).json(json!( {
        "document_key": doc.id.unwrap(),
    })))
}

#[delete("/{document_key}")]
async fn delete(db_pool: Data<DbPool>, document_key: Path<i64>) -> Result<HttpResponse> {
    let document_key = document_key.into_inner();
    if !Document::delete(db_pool, document_key).await? {
        return Err(DocumentErrors::NotFound { document_key }.into());
    }
    Ok(HttpResponse::build(StatusCode::NO_CONTENT).body(""))
}

#[cfg(test)]
mod tests {
    use actix_web::http::header::ContentType;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use serde::Deserialize;

    use crate::client::PostgresConfig;
    use crate::models::{Create, Delete, Document};
    use crate::views::tests::create_test_service;

    #[actix_test]
    async fn get_document() {
        let service = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Creating the document
        let doc_data = "Test data".as_bytes().to_vec();
        let doc = Document::new("text/plain".to_string(), doc_data.clone())
            .create(pool.clone())
            .await
            .unwrap();

        let doc_key = doc.id.unwrap();
        let url = format!("/documents/{}", doc_key);

        // Should succeed
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete the document
        assert!(Document::delete(pool.clone(), doc_key).await.unwrap());

        // Should fail
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_client_error());
    }

    #[actix_test]
    async fn document_get_url() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Creating the document
        let doc_data = "Test data".as_bytes().to_vec();
        let doc = Document::new("text/plain".to_string(), doc_data.clone())
            .create(pool.clone())
            .await
            .unwrap();
        let key = doc.id.unwrap();

        // Delete doc
        assert!(Document::delete(pool.clone(), key).await.unwrap());
    }

    #[derive(Deserialize, Clone, Debug)]
    struct PostDocumentResponse {
        document_key: i64,
    }

    #[actix_test]
    async fn document_post_and_delete() {
        let service = create_test_service().await;

        // Insert document
        let request = TestRequest::post()
            .uri("/documents")
            .insert_header(ContentType::plaintext())
            .set_payload("Test data".as_bytes().to_vec())
            .to_request();
        let response: PostDocumentResponse = call_and_read_body_json(&service, request).await;

        // Delete the document
        let request = TestRequest::delete()
            .uri(format!("/documents/{}", response.document_key).as_str())
            .to_request();
        assert!(call_service(&service, request).await.status().is_success());
    }
}
