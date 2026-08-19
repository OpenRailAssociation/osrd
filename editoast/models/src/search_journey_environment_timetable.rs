use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
#[sea_orm(table_name = "search_journey_environment_timetable")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "search_journey_environment_timetable_ids_key")]
    pub search_journey_environment_id: i64,
    #[sea_orm(unique_key = "search_journey_environment_timetable_ids_key")]
    pub timetable_id: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::search_journey_environment::Entity",
        from = "Column::SearchJourneyEnvironmentId",
        to = "super::search_journey_environment::Column::Id",
        on_delete = "Cascade"
    )]
    SearchJourneyEnvironment,
    #[sea_orm(
        belongs_to = "super::timetable::Entity",
        from = "Column::TimetableId",
        to = "super::timetable::Column::Id"
    )]
    Timetable,
}

impl Related<super::search_journey_environment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SearchJourneyEnvironment.def()
    }
}

impl Related<super::timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
