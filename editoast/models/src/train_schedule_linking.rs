use database::DbConnection;
use sea_orm::entity::prelude::*;
use std::ops::DerefMut;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[sea_orm(table_name = "train_schedule_linking")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "unique_target")]
    pub timetable_id: i64,
    #[sea_orm(unique_key = "unique_source")]
    pub source_train_schedule_id: i64,
    #[sea_orm(unique_key = "unique_source")]
    pub source_occurrence_index: Option<i64>,
    #[sea_orm(unique_key = "unique_source")]
    pub source_added_exception_id: Option<i64>,
    #[sea_orm(unique_key = "unique_source")]
    pub source_train_schedule_instance_index: Option<i64>,
    #[sea_orm(unique_key = "unique_target")]
    pub target_train_schedule_id: i64,
    #[sea_orm(unique_key = "unique_target")]
    pub target_occurrence_index: Option<i64>,
    #[sea_orm(unique_key = "unique_target")]
    pub target_added_exception_id: Option<i64>,
    #[sea_orm(unique_key = "unique_target")]
    pub target_train_schedule_instance_index: Option<i64>,
}

impl TrainScheduleLinking {
    pub async fn delete_linkings_for_train_schedule(
        conn: &mut DbConnection,
        train_schedule_id: i64,
    ) -> Result<usize, crate::Error> {
        use database::tables::train_schedule_linking::dsl;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;

        let deleted = diesel::delete(
            dsl::train_schedule_linking.filter(
                dsl::source_train_schedule_id
                    .eq(train_schedule_id)
                    .or(dsl::target_train_schedule_id.eq(train_schedule_id)),
            ),
        )
        .execute(conn.write().await.deref_mut())
        .await?;

        Ok(deleted)
    }
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
        belongs_to = "super::train_schedule::Entity",
        from = "Column::SourceTrainScheduleId",
        to = "super::train_schedule::Column::Id",
        on_delete = "Cascade"
    )]
    SourceTrainSchedule,
    #[sea_orm(
        belongs_to = "super::train_schedule::Entity",
        from = "Column::TargetTrainScheduleId",
        to = "super::train_schedule::Column::Id",
        on_delete = "Cascade"
    )]
    TargetTrainSchedule,
    #[sea_orm(
        belongs_to = "super::train_schedule_exception::Entity",
        from = "Column::SourceAddedExceptionId",
        to = "super::train_schedule_exception::Column::Id",
        on_delete = "Cascade"
    )]
    SourceException,
    #[sea_orm(
        belongs_to = "super::train_schedule_exception::Entity",
        from = "Column::TargetAddedExceptionId",
        to = "super::train_schedule_exception::Column::Id",
        on_delete = "Cascade"
    )]
    TargetException,
}

impl Related<super::timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
