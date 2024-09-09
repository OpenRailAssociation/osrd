//! This module manage rolling stock images in the database.
//!
//! A rolling stock can have several liveries, and each livery can have one or several separated
//! images and one compound image (created by aggregating the seperated images together).

use editoast_derive::Model;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Model)]
#[model(table = editoast_models::tables::rolling_stock_separate_image)]
#[model(gen(ops = c))]
pub struct RollingStockSeparatedImageModel {
    pub id: i64,
    pub order: i32,
    pub image_id: i64, // FK to document
    pub livery_id: i64,
}
