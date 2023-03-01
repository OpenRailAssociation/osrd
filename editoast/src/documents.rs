//! This module manage documents in the database.
//! You can add, retrieve and delete documents.
//! Documents are not meant to be modified, only deleted and re-inserted.
//!
//! Each document is identified by a unique key (`i64`).

use crate::error::Result;
use crate::tables::osrd_infra_document;
use crate::DbPool;
use actix_web::http::header::ContentType;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use diesel::{insert_into, QueryDsl, RunQueryDsl};
use editoast_derive::EditoastError;
use thiserror::Error;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "documents")]
enum DocumentErrors {
    #[error("Document not found")]
    #[editoast_error(status = 404)]
    NotFound { document_key: i64 },
}

#[derive(Debug, Insertable)]
#[diesel(table_name = osrd_infra_document)]
struct DocumentForm {
    content_type: String,
    data: Vec<u8>,
}

#[derive(Debug, Queryable)]
#[diesel(table_name = osrd_infra_document)]
pub struct Document {
    id: i64,
    content_type: String,
    data: Vec<u8>,
}

impl Document {
    /// Return the primary key of the document
    /// Can be useful for foreign key relations with a document
    #[allow(dead_code)] // TODO: Remove once it's used by studies
    pub fn get_key(&self) -> i64 {
        self.id
    }

    /// Return the content type of the document under the form of an [essence string](https://mimesniff.spec.whatwg.org/#mime-type-essence).
    pub fn get_content_type(&self) -> &String {
        &self.content_type
    }

    /// Return the owned data of the document
    pub fn inner_data(self) -> Vec<u8> {
        self.data
    }

    /// Load a document from the database by its key
    ///
    /// ```
    /// let doc_key: i64 = ...;
    /// let doc = Document::load(db_pool, doc_key).await?;
    /// let content_type = doc.get_content_type().clone();
    /// let doc_data = doc.inner_data();
    /// ```
    pub async fn load(db_pool: Data<DbPool>, document_key: i64) -> Result<Document> {
        block::<_, Result<Document>>(move || {
            use crate::tables::osrd_infra_document::dsl::*;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match osrd_infra_document
                .filter(id.eq(document_key))
                .get_result(&mut conn)
            {
                Ok(doc) => Ok(doc),
                Err(DieselError::NotFound) => Err(DocumentErrors::NotFound { document_key }.into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    /// Insert a document in the database.
    ///
    /// ```rust
    /// let image: Vec<u8> = ...;
    /// let doc = Document::insert(db_pool, ContentType::png(), image).await?;
    /// let doc_key = doc.get_key(); // Can be used as a foreign key
    /// ```
    #[allow(dead_code)] // TODO: Remove once it's used by studies
    pub async fn insert(
        db_pool: Data<DbPool>,
        content_type: ContentType,
        data: Vec<u8>,
    ) -> Result<Document> {
        let form = DocumentForm {
            content_type: content_type.essence_str().to_string(),
            data,
        };
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_document::dsl::*;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match insert_into(osrd_infra_document)
                .values(&form)
                .get_result(&mut conn)
            {
                Ok(project) => Ok(project),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    /// Delete a document in the database.
    /// Return an error if the document does not exist.
    ///
    /// ```
    /// let doc_key: i64 = ...;
    /// Document::delete(db_pool, doc_key).await?;
    /// ```
    #[allow(dead_code)] // TODO: Remove once it's used by studies or rolling stocks
    pub async fn delete(db_pool: Data<DbPool>, document_key: i64) -> Result<()> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_document::dsl::*;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match diesel::delete(osrd_infra_document.filter(id.eq(document_key))).execute(&mut conn)
            {
                Ok(1) => Ok(()),
                Ok(_) => Err(DocumentErrors::NotFound { document_key }.into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use actix_web::http::header::ContentType;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    use crate::client::PostgresConfig;
    use crate::documents::{Document, DocumentErrors};
    use crate::error::EditoastError;

    #[actix_test]
    async fn crud_document() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());
        let data = "Test Data".as_bytes().to_vec();

        let doc = Document::insert(pool.clone(), ContentType::plaintext(), data)
            .await
            .unwrap();

        // Delete the document
        Document::delete(pool.clone(), doc.get_key()).await.unwrap();

        // Second delete should fail
        assert_eq!(
            Document::delete(pool.clone(), doc.get_key())
                .await
                .unwrap_err()
                .get_type(),
            DocumentErrors::NotFound { document_key: 0 }.get_type()
        );
    }
}
