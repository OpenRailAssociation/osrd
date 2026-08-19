use database::Db;
use sea_orm::ColumnTrait as _;
use sea_orm::EntityTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::QueryOrder as _;
use sea_orm::QuerySelect as _;
use sea_orm::QueryTrait as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::timetable_type::TimetableType;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, Eq, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "train_schedule_set")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "train_schedule_set_catalog_entry_name_published_unique")]
    pub catalog_entry_id: Option<i64>,
    #[sea_orm(unique_key = "train_schedule_set_catalog_entry_name_published_unique")]
    pub name: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub description: String,
    pub published: bool,
    pub timetable_type: TimetableType,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::catalog_entry::Entity",
        from = "Column::CatalogEntryId",
        to = "super::catalog_entry::Column::Id"
    )]
    CatalogEntry,
    #[sea_orm(has_many = "super::timetable_train_schedule_set::Entity")]
    TimetableTrainScheduleSet,
    #[sea_orm(has_many = "super::train_schedule::Entity")]
    TrainSchedule,
}

impl Related<super::catalog_entry::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CatalogEntry.def()
    }
}

impl Related<super::timetable_train_schedule_set::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TimetableTrainScheduleSet.def()
    }
}

impl Related<super::train_schedule::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrainSchedule.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    /// Deletes train schedule sets that are not published or linked to a timetable
    pub async fn delete_orphaned(db: Db) -> Result<usize, crate::Error> {
        let max_to_delete_per_batch = 10;
        let mut total_deleted = 0;
        loop {
            let deleted_count = db
                .transaction::<_, _, crate::Error>(|txn| {
                    Box::pin(async move {
                        let linked_ids = super::timetable_train_schedule_set::Entity::find()
                            .select_only()
                            .column(super::timetable_train_schedule_set::Column::TrainScheduleSetId)
                            .into_query();
                        let ids_to_delete: Vec<i64> = Entity::find()
                            .select_only()
                            .column(Column::Id)
                            .filter(Column::Published.eq(false))
                            .filter(Column::Id.not_in_subquery(linked_ids))
                            .order_by_asc(Column::Id)
                            .limit(max_to_delete_per_batch)
                            .into_tuple()
                            .all(txn)
                            .await?;

                        if ids_to_delete.is_empty() {
                            return Ok(0);
                        }

                        // Delete the found train schedule sets
                        let deleted = Entity::delete_many()
                            .filter(Column::Id.is_in(ids_to_delete))
                            .exec(txn)
                            .await?;
                        Ok(usize::try_from(deleted.rows_affected)
                            .expect("deleted train schedule set count exceeds usize::MAX"))
                    })
                })
                .await?;

            if deleted_count == 0 {
                break;
            }

            total_deleted += deleted_count;
        }
        Ok(total_deleted)
    }
}
