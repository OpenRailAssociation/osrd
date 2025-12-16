use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate as editoast_models;
#[derive(Deserialize, Serialize, ToSchema, Debug, Clone, Model)]
#[model(table = database::tables::catalog_entry)]
#[model(gen(ops = crud, batch_ops = crud, list))]
#[model(row(derive(diesel::QueryableByName)))]
pub struct CatalogEntry {
    pub id: i64,
    pub name: Option<String>,
}
