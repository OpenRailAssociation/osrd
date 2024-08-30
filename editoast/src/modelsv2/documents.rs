//! This module manage documents in the database.
//!
//! Each document is identified by a unique key (`i64`).

use editoast_derive::ModelV2;

#[derive(Debug, Default, Clone, ModelV2)]
#[model(table = editoast_models::tables::document)]
pub struct Document {
    pub id: i64,
    pub content_type: String,
    pub data: Vec<u8>,
}
