use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Deserialize, Serialize, ToSchema)]
pub struct CatalogEntry {
    pub id: i64,
    pub name: Option<String>,
}
