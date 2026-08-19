use std::collections::HashMap;

use database::Db;
use itertools::Itertools as _;
use schemas::paced_train::PacedTrainException;
use schemas::train_schedule_exception::TrainScheduleExceptionChangeGroups;
use sea_orm::ColumnTrait as _;
use sea_orm::EntityTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::QueryOrder as _;
use sea_orm::entity::prelude::*;

use crate::sea_orm_types::ForeignJson;

#[derive(Clone, Debug, DeriveEntityModel, PartialEq)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[sea_orm(table_name = "train_schedule_exception")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(
        column_type = "Text",
        nullable,
        unique_key = "idx_unique_train_schedule_by_key"
    )]
    pub key: Option<String>,
    #[sea_orm(unique_key = "idx_unique_train_schedule_by_key")]
    pub timetable_id: i64,
    #[sea_orm(unique_key = "idx_unique_train_schedule_by_key")]
    pub train_schedule_id: i64,
    #[sea_orm(unique_key = "train_schedule_exception_timetable_id_train_schedule_id_occ_key")]
    pub occurrence_index: Option<i64>,
    pub disabled: bool,
    #[sea_orm(column_type = "JsonBinary")]
    pub change_groups: ForeignJson<TrainScheduleExceptionChangeGroups>,
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
        from = "Column::TrainScheduleId",
        to = "super::train_schedule::Column::Id",
        on_delete = "Cascade"
    )]
    TrainSchedule,
}

impl Related<super::timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl Related<super::train_schedule::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrainSchedule.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[cfg(any(test, feature = "testing"))]
impl Model {
    pub fn fixture_created(key: &str, occurrence_index: Option<i64>) -> Self {
        Self {
            id: 1,
            disabled: false,
            key: Some(key.into()),
            occurrence_index,
            timetable_id: 1,
            train_schedule_id: 1,
            change_groups: ForeignJson::new(TrainScheduleExceptionChangeGroups::fixture_created()),
        }
    }

    pub fn fixture_modified(key: &str, occurrence_index: i64) -> Self {
        Self {
            id: 1,
            disabled: false,
            key: Some(key.into()),
            occurrence_index: Some(occurrence_index),
            timetable_id: 1,
            train_schedule_id: 1,
            change_groups: ForeignJson::new(TrainScheduleExceptionChangeGroups::fixture_modified()),
        }
    }
}

impl From<Model> for schemas::TrainScheduleException {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,
            key: model.key,
            timetable_id: model.timetable_id,
            train_schedule_id: model.train_schedule_id,
            occurrence_index: model.occurrence_index,
            disabled: model.disabled,
            change_groups: model.change_groups.into_inner(),
        }
    }
}

impl Model {
    pub async fn retrieve_exceptions_by_train_schedules(
        db: Db,
        timetable_id: i64,
        train_schedule_ids: &[i64],
    ) -> Result<Vec<Self>, crate::Error> {
        let exceptions = Entity::find()
            .filter(Column::TimetableId.eq(timetable_id))
            .filter(Column::TrainScheduleId.is_in(train_schedule_ids.iter().copied()))
            .order_by_asc(Column::Id)
            .all(&db)
            .await?;
        let mut by_train: HashMap<_, Vec<_>> = exceptions
            .into_iter()
            .into_group_map_by(|exception| exception.train_schedule_id);
        Ok(train_schedule_ids
            .iter()
            .flat_map(|id| by_train.remove(id).unwrap_or_default())
            .collect())
    }

    pub async fn delete_exceptions_for_train_schedule(
        db: Db,
        train_schedule_id: i64,
    ) -> Result<usize, crate::Error> {
        let deleted = Entity::delete_many()
            .filter(Column::TrainScheduleId.eq(train_schedule_id))
            .exec(&db)
            .await?;
        Ok(deleted.rows_affected as usize)
    }
}

impl From<Model> for PacedTrainException {
    fn from(model: Model) -> Self {
        let exception_type = match model.occurrence_index {
            Some(occurrence_index) => schemas::paced_train::ExceptionType::Modified {
                occurrence_index: occurrence_index as usize,
            },
            None => schemas::paced_train::ExceptionType::Created {},
        };
        Self {
            id: Some(model.id),
            key: model.key.unwrap_or_else(|| model.id.to_string()),
            exception_type,
            disabled: model.disabled,
            change_groups: model.change_groups.into_inner(),
        }
    }
}
