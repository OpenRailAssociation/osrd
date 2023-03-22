use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct RollingStockLivery {
    pub id: i64,
    pub name: String,
    pub rolling_stock_id: i64,
    pub compound_image_id: Option<i64>,
}
