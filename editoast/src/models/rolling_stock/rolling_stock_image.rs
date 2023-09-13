//! This module manage rolling stock images in the database.
//! You can add, retrieve and delete rolling stock images.
//!
//! A rolling stock can have several liveries, and each livery can have one or several separated
//! images and one compound image (created by aggregating the seperated images together).

use crate::tables::rolling_stock_separate_image;
use derivative::Derivative;
use editoast_derive::Model;
use serde::Serialize;

#[derive(Debug, Derivative, Identifiable, Insertable, Model, Queryable, Serialize)]
#[derivative(Default)]
#[model(table = "rolling_stock_separate_image")]
#[model(create)]
#[diesel(belongs_to(RollingStockLiveryModel, foreign_key = livery_id))]
#[diesel(table_name = rolling_stock_separate_image)]
pub struct RollingStockSeparatedImageModel {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = i32)]
    pub order: Option<i32>,
    #[diesel(deserialize_as = i64)]
    pub image_id: Option<i64>, // FK to document
    #[diesel(deserialize_as = i64)]
    pub livery_id: Option<i64>,
}
