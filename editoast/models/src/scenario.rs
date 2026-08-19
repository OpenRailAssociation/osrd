use chrono::Utc;
use database::Db;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ActiveValue::Set;
use sea_orm::DatabaseTransaction;
use sea_orm::EntityTrait as _;
use sea_orm::QuerySelect as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::project;
use crate::study;
use crate::tags::Tags;
use crate::timetable;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, Eq, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "scenario")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub infra_id: i64,
    pub name: String,
    pub description: String,
    pub creation_date: chrono::DateTime<chrono::Utc>,
    pub last_modification: chrono::DateTime<chrono::Utc>,
    pub tags: Tags,
    #[sea_orm(unique)]
    pub timetable_id: i64,
    pub study_id: i64,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub electrical_profile_set_id: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::electrical_profiles::Entity",
        from = "Column::ElectricalProfileSetId",
        to = "super::electrical_profiles::Column::Id",
        on_delete = "Cascade"
    )]
    ElectricalProfileSet,
    #[sea_orm(
        belongs_to = "super::infra::Entity",
        from = "Column::InfraId",
        to = "super::infra::Column::Id",
        on_delete = "Cascade"
    )]
    Infra,
    #[sea_orm(has_many = "super::macro_node::Entity")]
    MacroNode,
    #[sea_orm(has_many = "super::macro_note::Entity")]
    MacroNote,
    #[sea_orm(
        belongs_to = "super::study::Entity",
        from = "Column::StudyId",
        to = "super::study::Column::Id",
        on_delete = "Cascade"
    )]
    Study,
    #[sea_orm(
        belongs_to = "super::timetable::Entity",
        from = "Column::TimetableId",
        to = "super::timetable::Column::Id",
        on_delete = "Cascade"
    )]
    Timetable,
}

impl Related<super::infra::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Infra.def()
    }
}

impl Related<super::study::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Study.def()
    }
}

impl Related<super::timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(thiserror::Error, derive_more::From, Debug)]
pub enum Error {
    #[error("Scenario with id {scenario_id} not found")]
    NotFound { scenario_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
}

impl Model {
    pub async fn infra_name(&self, db: Db) -> Result<String, crate::Error> {
        super::infra::Entity::find_by_id(self.infra_id)
            .select_only()
            .column(super::infra::Column::Name)
            .into_tuple()
            .one(&db)
            .await?
            .ok_or_else(|| crate::Error::from(DbErr::RecordNotFound("infra".into())))
    }

    pub async fn train_schedules_count(&self, db: Db) -> Result<i64, crate::Error> {
        timetable::Model::train_schedules_count(self.timetable_id, db).await
    }

    /// Opens a transaction, retrieves the [Model], its [Study] and [Project] and
    /// calls the provided closure with these objects
    ///
    /// The last modification field of these three objects are updated before the transaction is committed.
    #[tracing::instrument(skip(db, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        db: Db,
        scenario_id: i64,
        f: F,
    ) -> Result<Result<T, E>, Error>
    where
        F: for<'a> AsyncFnOnce(
                &'a DatabaseTransaction,
                Self,
                study::Model,
                project::Model,
            ) -> Result<T, E>
            + Send,
        T: Send,
        E: Send,
    {
        let txn = db.begin().await?;
        let scenario = Entity::find_by_id(scenario_id)
            .one(&txn)
            .await?
            .ok_or(Error::NotFound { scenario_id })?;
        let study = super::study::Entity::find_by_id(scenario.study_id)
            .one(&txn)
            .await?
            .expect("scenario study foreign key must reference a study");
        let study_id = study.id;
        let project = super::project::Entity::find_by_id(study.project_id)
            .one(&txn)
            .await?
            .expect("study project foreign key must reference a project");
        let project_id = project.id;
        let result = match f(&txn, scenario, study, project).await {
            Ok(result) => result,
            Err(error) => {
                txn.commit().await?;
                return Ok(Err(error));
            }
        };
        let now = Utc::now();
        ActiveModel {
            id: Set(scenario_id),
            last_modification: Set(now),
            ..Default::default()
        }
        .update(&txn)
        .await?;
        study::ActiveModel {
            id: Set(study_id),
            last_modification: Set(now),
            ..Default::default()
        }
        .update(&txn)
        .await?;
        project::ActiveModel {
            id: Set(project_id),
            last_modification: Set(now),
            ..Default::default()
        }
        .update(&txn)
        .await?;
        txn.commit().await?;
        Ok(Ok(result))
    }
}

#[cfg(any(test, feature = "testing"))]
impl ActiveModel {
    pub fn fake(name: impl Into<String>, study_id: i64, infra_id: i64, timetable_id: i64) -> Self {
        Self {
            name: Set(name.into()),
            description: Set(String::new()),
            creation_date: Set(Utc::now()),
            last_modification: Set(Utc::now()),
            tags: Set(Tags::default()),
            study_id: Set(study_id),
            infra_id: Set(infra_id),
            timetable_id: Set(timetable_id),
            ..Default::default()
        }
    }
}
