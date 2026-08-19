use chrono::Utc;
use database::Db;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ActiveValue::Set;
use sea_orm::DatabaseTransaction;
use sea_orm::EntityTrait as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::project;
use crate::tags::Tags;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, Eq, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "study")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub business_code: Option<String>,
    pub service_code: Option<String>,
    pub creation_date: chrono::DateTime<chrono::Utc>,
    pub last_modification: chrono::DateTime<chrono::Utc>,
    pub start_date: Option<Date>,
    pub expected_end_date: Option<Date>,
    pub actual_end_date: Option<Date>,
    pub budget: Option<i32>,
    pub tags: Tags,
    pub state: String,
    pub study_type: Option<String>,
    pub project_id: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::project::Entity",
        from = "Column::ProjectId",
        to = "super::project::Column::Id",
        on_delete = "Cascade"
    )]
    Project,
    #[sea_orm(has_many = "super::scenario::Entity")]
    Scenario,
}

impl Related<super::project::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::scenario::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Scenario.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(thiserror::Error, derive_more::From, Debug)]
pub enum Error {
    #[error("Study with id {study_id} not found")]
    NotFound { study_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
}

impl Model {
    /// Opens a transaction, retrieves the [Model] and its [Project] and calls the provided closure with these
    ///
    /// The last modification field of these objects are updated before the transaction is committed.
    #[tracing::instrument(skip(db, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        db: Db,
        study_id: i64,
        f: F,
    ) -> Result<Result<T, E>, Error>
    where
        F: for<'a> AsyncFnOnce(&'a DatabaseTransaction, Self, project::Model) -> Result<T, E>
            + Send,
        T: Send,
        E: Send,
    {
        let txn = db.begin().await?;
        let study = Entity::find_by_id(study_id)
            .one(&txn)
            .await?
            .ok_or(Error::NotFound { study_id })?;
        let project = super::project::Entity::find_by_id(study.project_id)
            .one(&txn)
            .await?
            .expect("study project foreign key must reference a project");
        let project_id = project.id;
        let result = match f(&txn, study, project).await {
            Ok(result) => result,
            Err(error) => {
                txn.commit().await?;
                return Ok(Err(error));
            }
        };
        let now = Utc::now();
        ActiveModel {
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
    pub fn fake(name: impl Into<String>, project_id: i64) -> Self {
        Self {
            name: Set(name.into()),
            creation_date: Set(Utc::now()),
            last_modification: Set(Utc::now()),
            budget: Set(Some(0)),
            tags: Set(Tags::default()),
            state: Set("some_state".into()),
            project_id: Set(project_id),
            ..Default::default()
        }
    }
}

#[cfg(test)]
pub mod tests {
    use pretty_assertions::assert_eq;
    use sea_orm::QueryOrder as _;

    use super::*;
    use crate::project;
    use crate::study;
    use database::Db;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_retrieve() {
        let db = Db::for_tests().await;
        let created_project = project::ActiveModel::fake("test_project_name")
            .insert(&db)
            .await
            .expect("Failed to create project");

        let study_name = "test_study_name";
        let created_study = study::ActiveModel::fake(study_name, created_project.id)
            .insert(&db)
            .await
            .expect("Failed to create study");

        // Retrieve a study
        let study = Entity::find_by_id(created_study.id)
            .one(&db)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        assert_eq!(&created_study, &study);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sort_study() {
        let db = Db::for_tests().await;

        let created_project = project::ActiveModel::fake("test_project_name")
            .insert(&db)
            .await
            .expect("Failed to create project");

        let _created_study_1 = study::ActiveModel::fake("test_study_name_1", created_project.id)
            .insert(&db)
            .await
            .expect("Failed to create study");

        let _created_study_2 = study::ActiveModel::fake("test_study_name_2", created_project.id)
            .insert(&db)
            .await
            .expect("Failed to create study");

        let studies = Entity::find()
            .order_by_desc(Column::Name)
            .all(&db)
            .await
            .expect("Failed to retrieve studies");

        for (s1, s2) in studies.iter().zip(studies.iter().skip(1)) {
            let name_1 = s1.name.to_lowercase();
            let name_2 = s2.name.to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }
}
