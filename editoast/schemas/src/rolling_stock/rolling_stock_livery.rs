use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[editoast_derive::openapi_schema]
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct RollingStockLivery {
    pub id: i64,
    pub name: String,
    pub rolling_stock_id: i64,
    pub compound_image_id: Option<i64>,
}

#[editoast_derive::openapi_schema]
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct RollingStockLiveryMetadata {
    pub id: i64,
    pub name: String,
    pub compound_image_id: Option<i64>,
}
