use database::Db;
use sea_orm::ColumnTrait as _;
use sea_orm::EntityTrait as _;
use sea_orm::FromQueryResult;
use sea_orm::JoinType;
use sea_orm::QueryFilter as _;
use sea_orm::QuerySelect as _;
use sea_orm::RelationTrait as _;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock;

#[derive(Debug, FromQueryResult, Serialize, ToSchema)]
#[cfg_attr(
    any(test, feature = "testing"),
    derive(PartialEq, Eq, PartialOrd, Ord, serde::Deserialize)
)]
pub struct ScenarioReference {
    pub project_id: i64,
    pub project_name: String,
    pub study_id: i64,
    pub study_name: String,
    pub scenario_id: i64,
    pub scenario_name: String,
}

impl rolling_stock::Model {
    pub async fn get_usage(&self, db: Db) -> Result<Vec<ScenarioReference>, crate::Error> {
        super::super::train_schedule::Entity::find()
            .select_only()
            .column_as(super::super::project::Column::Id, "project_id")
            .column_as(super::super::project::Column::Name, "project_name")
            .column_as(super::super::study::Column::Id, "study_id")
            .column_as(super::super::study::Column::Name, "study_name")
            .column_as(super::super::scenario::Column::Id, "scenario_id")
            .column_as(super::super::scenario::Column::Name, "scenario_name")
            .join(
                JoinType::InnerJoin,
                super::super::train_schedule::Relation::TrainScheduleSet.def(),
            )
            .join_rev(
                JoinType::InnerJoin,
                super::super::timetable_train_schedule_set::Relation::TrainScheduleSet.def(),
            )
            .join(
                JoinType::InnerJoin,
                super::super::timetable_train_schedule_set::Relation::Timetable.def(),
            )
            .join_rev(
                JoinType::InnerJoin,
                super::super::scenario::Relation::Timetable.def(),
            )
            .join(
                JoinType::InnerJoin,
                super::super::scenario::Relation::Study.def(),
            )
            .join(
                JoinType::InnerJoin,
                super::super::study::Relation::Project.def(),
            )
            .filter(super::super::train_schedule::Column::RollingStockName.eq(&self.name))
            .into_model::<ScenarioReference>()
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }
}
