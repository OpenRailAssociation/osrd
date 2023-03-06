use crate::documents::Document;
use crate::error::Result;
use crate::DbPool;
use actix_http::StatusCode;
use actix_web::dev::HttpServiceFactory;
use actix_web::http::header::ContentType;
use actix_web::web::{scope, Bytes, Data, Header, Path};
use actix_web::{get, post, HttpResponse};
use serde_json::json;

pub fn routes() -> impl HttpServiceFactory {
    scope("/documents").service((get, post))
}

#[get("/{document_key}")]
async fn get(db_pool: Data<DbPool>, document_key: Path<i64>) -> Result<HttpResponse> {
    let doc = Document::load(db_pool, document_key.into_inner()).await?;
    Ok(HttpResponse::build(StatusCode::OK)
        .content_type(doc.get_content_type().clone())
        .body(doc.inner_data()))
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
    let doc = Document::insert(db_pool, content_type, bytes.to_vec()).await?;

    // Response
    Ok(HttpResponse::build(StatusCode::CREATED).json(json!( {
        "document_key": doc.get_key(),
    })))
}

impl Document {
    /// Return the URL to retrieve the document
    ///
    /// ```
    /// let doc_key = 42;
    /// let doc = Document::load(db_pool, doc_key).await?;
    /// let url = doc.get_url("http://localhost:8090");
    /// assert_eq!(url, "http://localhost:8090/documents/42".to_string())
    /// ```
    #[allow(dead_code)] // TODO: Remove once it's used by studies or rolling stocks
    pub fn get_url<T: AsRef<str>>(&self, base_url: T) -> String {
        let base_url = base_url.as_ref();
        if base_url.ends_with('/') {
            format!("{}documents/{}", base_url, self.get_key())
        } else {
            format!("{}/documents/{}", base_url, self.get_key())
        }
    }
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
    use crate::documents::Document;
    use crate::views::tests::create_test_service;

    #[actix_test]
    async fn get_document() {
        let service = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Creating the document
        let doc_data = "Test data".as_bytes().to_vec();
        let doc = Document::insert(
            pool.clone(),
            ContentType::plaintext().essence_str(),
            doc_data,
        )
        .await
        .unwrap();

        let url = doc.get_url("/");

        // Should succeed
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete the document
        Document::delete(pool.clone(), doc.get_key()).await.unwrap();

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
        let doc = Document::insert(
            pool.clone(),
            ContentType::plaintext().essence_str(),
            doc_data,
        )
        .await
        .unwrap();
        let key = doc.get_key();

        // Testing get_url
        let url_ref = format!("http://localhost:8090/documents/{key}");
        assert_eq!(doc.get_url("http://localhost:8090"), url_ref);
        assert_eq!(doc.get_url("http://localhost:8090/"), url_ref);

        // Delete doc
        Document::delete(pool.clone(), key).await.unwrap();
    }

    #[derive(Deserialize, Clone, Debug)]
    struct PostDocumentResponse {
        document_key: i64,
    }

    #[actix_test]
    async fn document_post() {
        let service = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Insert data
        let request = TestRequest::post()
            .uri("/documents")
            .insert_header(ContentType::plaintext())
            .set_payload("Test data".as_bytes().to_vec())
            .to_request();
        let response: PostDocumentResponse = call_and_read_body_json(&service, request).await;

        // Delete the document
        Document::delete(pool.clone(), response.document_key)
            .await
            .unwrap();
    }
}
