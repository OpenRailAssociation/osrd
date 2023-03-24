//! This module manage rolling stock images in the database.
//! You can add, retrieve and delete rolling stock images.
//!
//! A rolling stock can have several liveries, and each livery can have one or several separated
//! images and one compound image (created by aggregating the seperated images together).

use crate::tables::osrd_infra_rollingstockimage;
use serde::Serialize;

#[derive(Debug, Identifiable, Queryable, Serialize)]
#[diesel(belongs_to(RollingStockLiveryModel, foreign_key = livery_id))]
#[diesel(table_name = osrd_infra_rollingstockimage)]
pub struct RollingStockSeparatedImageModel {
    id: i64,
    image_id: i64, // FK to document
    livery_id: i64,
    order: i64,
}
