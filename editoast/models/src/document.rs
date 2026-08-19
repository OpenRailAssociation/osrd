//! This module manage documents in the database.
//!
//! Each document is identified by a unique key (`i64`).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, Default, DeriveEntityModel, Eq, PartialEq)]
#[sea_orm(table_name = "document")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub content_type: String,
    #[sea_orm(column_type = "VarBinary(StringLen::None)")]
    pub data: Vec<u8>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::project::Entity")]
    Project,
    #[sea_orm(has_one = "super::rolling_stock_livery::Entity")]
    RollingStockLivery,
    #[sea_orm(has_one = "super::rolling_stock_image::Entity")]
    RollingStockImage,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::rolling_stock_livery::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RollingStockLivery.def()
    }
}

impl Related<super::rolling_stock_image::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RollingStockImage.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
