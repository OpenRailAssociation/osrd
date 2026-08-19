//! This module manage rolling stock images in the database.
//!
//! A rolling stock can have several liveries, and each livery can have one or several separated
//! images and one compound image (created by aggregating the separated images together).

use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq, Serialize)]
#[sea_orm(table_name = "rolling_stock_separate_image")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "rolling_stock_separate_image_livery_id_order_key")]
    pub order: i32,
    #[sea_orm(unique)]
    pub image_id: i64,
    #[sea_orm(unique_key = "rolling_stock_separate_image_livery_id_order_key")]
    pub livery_id: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::document::Entity",
        from = "Column::ImageId",
        to = "super::document::Column::Id",
        on_delete = "Cascade"
    )]
    Document,
    #[sea_orm(
        belongs_to = "super::rolling_stock_livery::Entity",
        from = "Column::LiveryId",
        to = "super::rolling_stock_livery::Column::Id",
        on_delete = "Cascade"
    )]
    RollingStockLivery,
}

impl Related<super::document::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Document.def()
    }
}

impl Related<super::rolling_stock_livery::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RollingStockLivery.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
