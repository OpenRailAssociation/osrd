use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Deserialize, Serialize, ToSchema)]
pub struct CatalogueEntry {
    pub id: i64,
    pub name: Option<String>,
}
