use database::Db;
use itertools::Itertools as _;
use sea_orm::ColumnTrait as _;
use sea_orm::Condition;
use sea_orm::EntityTrait as _;
use sea_orm::PaginatorTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::QueryOrder as _;
use sea_orm::QuerySelect as _;
use sea_orm::QueryTrait as _;
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq, sqlx::FromRow)]
#[sea_orm(table_name = "train_schedule_round_trips")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    /// ID of the first train schedule of this round trip
    #[sea_orm(unique)]
    pub left_id: i64,
    /// ID of the second train schedule of this round trip
    /// This is `None` for one-way trains
    #[sea_orm(unique)]
    pub right_id: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    LeftTrain,
    RightTrain,
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::LeftTrain => Entity::belongs_to(super::train_schedule::Entity)
                .from(Column::LeftId)
                .to(super::train_schedule::Column::Id)
                .on_delete(ForeignKeyAction::Cascade)
                .into(),
            Self::RightTrain => Entity::belongs_to(super::train_schedule::Entity)
                .from(Column::RightId)
                .to(super::train_schedule::Column::Id)
                .on_delete(ForeignKeyAction::Cascade)
                .into(),
        }
    }
}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    #[tracing::instrument(
        name = "list_paginated<TrainScheduleRoundTrips>",
        skip_all,
        err,
        fields(timetable_id, limit, offset)
    )]
    pub async fn list_paginated(
        db: Db,
        timetable_id: i64,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<Self>, u64), crate::Error> {
        let train_schedule_set_ids = super::timetable_train_schedule_set::Entity::find()
            .select_only()
            .column(super::timetable_train_schedule_set::Column::TrainScheduleSetId)
            .filter(super::timetable_train_schedule_set::Column::TimetableId.eq(timetable_id))
            .into_query();
        let left_train_ids = super::train_schedule::Entity::find()
            .select_only()
            .column(super::train_schedule::Column::Id)
            .filter(
                super::train_schedule::Column::TrainScheduleSetId
                    .in_subquery(train_schedule_set_ids),
            )
            .into_query();
        let query = Entity::find().filter(Column::LeftId.in_subquery(left_train_ids));
        let count = query.clone().count(&db).await?;
        let rows = query
            .order_by_asc(Column::Id)
            .limit(page_size)
            .offset(page.saturating_sub(1).saturating_mul(page_size))
            .all(&db)
            .await?;
        Ok((rows, count))
    }

    /// Deletes a batch of train schedule round trips given a list of train schedule IDs
    ///
    /// **IMPORTANT**: This function does not take ids of round trips, but rather the IDs of the train schedules
    #[tracing::instrument(
        name = "delete_batch_train_ids<TrainScheduleRoundTrips>",
        skip_all,
        err,
        fields(train_schedule_ids)
    )]
    pub async fn delete_batch_train_ids<I: IntoIterator<Item = i64> + Send>(
        db: Db,
        train_schedule_ids: I,
    ) -> Result<usize, crate::Error> {
        let ids = train_schedule_ids.into_iter().collect_vec();
        let deleted = Entity::delete_many()
            .filter(
                Condition::any()
                    .add(Column::LeftId.is_in(ids.iter().copied()))
                    .add(Column::RightId.is_in(ids)),
            )
            .exec(&db)
            .await?;
        Ok(deleted.rows_affected as usize)
    }

    /// Retrieves a batch of train schedule round trips given a list of train schedule IDs
    ///
    /// **IMPORTANT**: This function does not take ids of round trips, but rather the IDs of the train schedules
    pub async fn retrieve_from_train_schedule_ids<I: IntoIterator<Item = i64> + Send>(
        db: Db,
        train_schedule_ids: I,
    ) -> Result<Vec<Self>, crate::Error> {
        let ids = train_schedule_ids.into_iter().collect_vec();
        Entity::find()
            .filter(
                Condition::any()
                    .add(Column::LeftId.is_in(ids.iter().copied()))
                    .add(Column::RightId.is_in(ids)),
            )
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }
}
