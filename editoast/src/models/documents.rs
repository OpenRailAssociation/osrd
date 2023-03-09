//! This module manage documents in the database.
//! You can add, retrieve and delete documents.
//! Documents are not meant to be modified, only deleted and re-inserted.
//!
//! Each document is identified by a unique key (`i64`).

use crate::tables::osrd_infra_document;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use editoast_derive::Model;

#[derive(Debug, Default, Queryable, Insertable, Model)]
#[model(table = "osrd_infra_document")]
#[model(create, delete, retrieve)]
#[diesel(table_name = osrd_infra_document)]
pub struct Document {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub content_type: Option<String>,
    #[diesel(deserialize_as = Vec<u8>)]
    pub data: Option<Vec<u8>>,
}

impl Document {
    pub fn new(content_type: String, data: Vec<u8>) -> Self {
        Self {
            id: None,
            content_type: Some(content_type),
            data: Some(data),
        }
    }
}
