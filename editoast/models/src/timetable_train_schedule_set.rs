use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, Default, DeriveEntityModel, Eq, PartialEq)]
#[sea_orm(table_name = "timetable_train_schedule_set")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "timetable_train_schedule_set_ids_key")]
    pub timetable_id: i64,
    #[sea_orm(unique_key = "timetable_train_schedule_set_ids_key")]
    pub train_schedule_set_id: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::timetable::Entity",
        from = "Column::TimetableId",
        to = "super::timetable::Column::Id",
        on_delete = "Cascade"
    )]
    Timetable,
    #[sea_orm(
        belongs_to = "super::train_schedule_set::Entity",
        from = "Column::TrainScheduleSetId",
        to = "super::train_schedule_set::Column::Id",
        on_delete = "Cascade"
    )]
    TrainScheduleSet,
}

impl Related<super::timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl Related<super::train_schedule_set::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrainScheduleSet.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
