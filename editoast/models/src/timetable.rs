use std::collections::HashSet;

use common::units::quantities::Offset;
use database::Db;
use sea_orm::ActiveValue::Set;
use sea_orm::ColumnTrait as _;
use sea_orm::EntityTrait as _;
use sea_orm::PaginatorTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::QuerySelect as _;
use sea_orm::QueryTrait as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;

use crate::sea_orm_types::Milliseconds;
use crate::timetable_train_schedule_set;
use crate::timetable_type::TimetableType;

#[derive(Clone, Debug, Default, DeriveEntityModel, Eq, PartialEq)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[sea_orm(table_name = "timetable")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub timetable_type: TimetableType,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_one = "super::scenario::Entity")]
    Scenario,
    #[sea_orm(has_many = "super::search_journey_environment_timetable::Entity")]
    SearchJourneyEnvironmentTimetable,
    #[sea_orm(has_many = "super::stdcm_search_environment::Entity")]
    StdcmSearchEnvironment,
    #[sea_orm(has_many = "super::timetable_train_schedule_set::Entity")]
    TimetableTrainScheduleSet,
    #[sea_orm(has_many = "super::train_schedule_exception::Entity")]
    TrainScheduleException,
    #[sea_orm(has_many = "super::train_schedule_linking::Entity")]
    TrainScheduleLinking,
}

impl ActiveModelBehavior for ActiveModel {}

impl From<Model> for Option<i64> {
    fn from(timetable: Model) -> Self {
        Some(timetable.id)
    }
}

impl Model {
    pub async fn train_schedules_count(timetable_id: i64, db: Db) -> Result<i64, crate::Error> {
        let train_schedule_set_ids = super::timetable_train_schedule_set::Entity::find()
            .select_only()
            .column(super::timetable_train_schedule_set::Column::TrainScheduleSetId)
            .filter(super::timetable_train_schedule_set::Column::TimetableId.eq(timetable_id))
            .into_query();
        let count = super::train_schedule::Entity::find()
            .filter(
                super::train_schedule::Column::TrainScheduleSetId
                    .in_subquery(train_schedule_set_ids),
            )
            .count(&db)
            .await?;
        Ok(i64::try_from(count).expect("train schedule count exceeds i64::MAX"))
    }

    pub async fn get_train_schedule_set_ids_from_timetable(
        timetable_id: i64,
        db: Db,
    ) -> Result<Vec<i64>, crate::Error> {
        super::timetable_train_schedule_set::Entity::find()
            .select_only()
            .column(super::timetable_train_schedule_set::Column::TrainScheduleSetId)
            .filter(super::timetable_train_schedule_set::Column::TimetableId.eq(timetable_id))
            .into_tuple()
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }

    pub async fn gather_start_times(
        timetable_id: i64,
        db: Db,
    ) -> Result<Vec<Offset>, crate::Error> {
        let train_schedule_set_ids = super::timetable_train_schedule_set::Entity::find()
            .select_only()
            .column(super::timetable_train_schedule_set::Column::TrainScheduleSetId)
            .filter(super::timetable_train_schedule_set::Column::TimetableId.eq(timetable_id))
            .into_query();
        let values: Vec<Milliseconds> = super::train_schedule::Entity::find()
            .select_only()
            .column(super::train_schedule::Column::StartTime)
            .filter(
                super::train_schedule::Column::TrainScheduleSetId
                    .in_subquery(train_schedule_set_ids),
            )
            .into_tuple()
            .all(&db)
            .await?;
        Ok(values.into_iter().map(Offset::from).collect())
    }

    pub async fn set_links_train_schedule_set(
        timetable_id: i64,
        train_schedule_set_ids: HashSet<i64>,
        db: Db,
    ) -> Result<(), crate::Error> {
        // Transaction to ensure consistency of modifications
        db.transaction::<_, _, crate::Error>(move |txn| {
            Box::pin(async move {
                // 1. Retrieve the current links
                let existing_linked_ids: HashSet<i64> =
                    super::timetable_train_schedule_set::Entity::find()
                        .select_only()
                        .column(super::timetable_train_schedule_set::Column::TrainScheduleSetId)
                        .filter(
                            super::timetable_train_schedule_set::Column::TimetableId
                                .eq(timetable_id),
                        )
                        .into_tuple()
                        .all(txn)
                        .await?
                        .into_iter()
                        .collect();

                // 2. Delete only the links that are NOT in the new list
                let links_to_delete = existing_linked_ids
                    .difference(&train_schedule_set_ids)
                    .copied()
                    .collect::<Vec<_>>();
                if !links_to_delete.is_empty() {
                    super::timetable_train_schedule_set::Entity::delete_many()
                        .filter(
                            super::timetable_train_schedule_set::Column::TimetableId
                                .eq(timetable_id),
                        )
                        .filter(
                            super::timetable_train_schedule_set::Column::TrainScheduleSetId
                                .is_in(links_to_delete),
                        )
                        .exec(txn)
                        .await?;
                }

                // 3. Create missing links
                let links_to_create = train_schedule_set_ids
                    .difference(&existing_linked_ids)
                    .map(
                        |train_schedule_set_id| timetable_train_schedule_set::ActiveModel {
                            timetable_id: Set(timetable_id),
                            train_schedule_set_id: Set(*train_schedule_set_id),
                            ..Default::default()
                        },
                    )
                    .collect::<Vec<_>>();
                if !links_to_create.is_empty() {
                    super::timetable_train_schedule_set::Entity::insert_many(links_to_create)
                        .exec(txn)
                        .await?;
                }
                Ok(())
            })
        })
        .await
        .map_err(Into::into)
    }

    /// Deletes timetables that are not referenced by any Scenario or StdcmSearchEnvironment
    /// Returns the number of deleted timetables
    pub async fn delete_orphaned(db: Db) -> Result<usize, crate::Error> {
        let scenarios = super::scenario::Entity::find()
            .select_only()
            .column(super::scenario::Column::TimetableId)
            .into_query();
        let stdcm_environments = super::stdcm_search_environment::Entity::find()
            .select_only()
            .column(super::stdcm_search_environment::Column::TimetableId)
            .into_query();
        let search_environments = super::search_journey_environment_timetable::Entity::find()
            .select_only()
            .column(super::search_journey_environment_timetable::Column::TimetableId)
            .into_query();
        let result = Entity::delete_many()
            .filter(Column::Id.not_in_subquery(scenarios))
            .filter(Column::Id.not_in_subquery(stdcm_environments))
            .filter(Column::Id.not_in_subquery(search_environments))
            .exec(&db)
            .await?;
        Ok(usize::try_from(result.rows_affected)
            .expect("deleted timetable count exceeds usize::MAX"))
    }
}

/// Should be used to retrieve a timetable with its paced trains
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct TimetableWithTrains {
    pub id: i64,
    pub timetable_type: TimetableType,
    pub paced_train_ids: Vec<i64>,
}

impl TimetableWithTrains {
    pub async fn retrieve(db: Db, timetable_id: i64) -> Result<Option<Self>, crate::Error> {
        Ok(sqlx::query_as!(
            Self,
            "SELECT timetable.id,
        timetable.timetable_type AS \"timetable_type: TimetableType\",
        array_remove(array_agg(train_schedule.id), NULL) AS \"paced_train_ids!\"
        FROM timetable
        JOIN timetable_train_schedule_set ON timetable.id = timetable_train_schedule_set.timetable_id
        LEFT JOIN train_schedule ON timetable_train_schedule_set.train_schedule_set_id = train_schedule.train_schedule_set_id
        WHERE timetable.id = $1
        GROUP BY timetable.id",
            timetable_id
        )
        .fetch_optional(db.sqlx())
        .await?)
    }

    pub async fn retrieve_or_fail<E, F>(db: Db, id: i64, fail: F) -> Result<Self, E>
    where
        E: From<crate::Error>,
        F: FnOnce() -> E + Send,
    {
        Self::retrieve(db, id)
            .await
            .map_err(E::from)?
            .ok_or_else(fail)
    }
}

impl From<TimetableWithTrains> for Model {
    fn from(value: TimetableWithTrains) -> Self {
        Self {
            id: value.id,
            timetable_type: value.timetable_type,
        }
    }
}
