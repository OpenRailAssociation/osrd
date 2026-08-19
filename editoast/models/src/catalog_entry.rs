use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Deserialize, DeriveEntityModel, Eq, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "catalog_entry")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub name: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::train_schedule_set::Entity")]
    TrainScheduleSet,
}

impl Related<super::train_schedule_set::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrainScheduleSet.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
