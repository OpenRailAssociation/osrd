//! This module manage documents in the database.
//!
//! Each document is identified by a unique key (`i64`).

use editoast_derive::Model;

use crate as editoast_models; // HACK: remove after all models are in this crate

#[derive(Debug, Default, Clone, Model)]
#[model(table = database::tables::document)]
#[model(gen(ops = crd))]
pub struct Document {
    pub id: i64,
    pub content_type: String,
    pub data: Vec<u8>,
}
