use serde::Serialize;

use crate::tables::{osrd_infra_rollingstockimage, osrd_infra_rollingstocklivery};

#[derive(Debug, Insertable, Identifiable)]
#[diesel(table_name = osrd_infra_rollingstockimage)]
pub struct RollingStockCompoundImage {
    id: i64,
    image: Vec<u8>, // binary field
}

#[derive(Debug, Insertable, Identifiable)]
#[diesel(belongs_to(RollingStockLivery, foreign_key = livery_id))]
#[diesel(table_name = osrd_infra_rollingstockimage)]
pub struct RollingStockSeparatedImage {
    id: i64,
    image: Vec<u8>, // binary field
    livery_id: i64,
    order: i64,
}

#[derive(Debug, Identifiable, Insertable)]
#[diesel(belongs_to(RollingStock, foreign_key = rolling_stock_id))]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLivery {
    pub id: i64,
    name: String,
    rolling_stock_id: i64,
    compound_image_id: i64,
}

#[derive(Debug, Queryable, Selectable, Serialize)]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLiveryMetadata {
    id: i64,
    name: String,
}
