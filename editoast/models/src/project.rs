use chrono::Utc;
use database::Db;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ActiveValue::Set;
use sea_orm::ConnectionTrait;
use sea_orm::DatabaseTransaction;
use sea_orm::EntityTrait as _;
use sea_orm::TransactionTrait;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::tags::Tags;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, Eq, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "project")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    pub objectives: Option<String>,
    pub description: Option<String>,
    pub funders: Option<String>,
    pub budget: Option<i32>,
    pub creation_date: chrono::DateTime<chrono::Utc>,
    pub last_modification: chrono::DateTime<chrono::Utc>,
    pub tags: Tags,
    #[sea_orm(column_name = "image_id")]
    pub image: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::document::Entity",
        from = "Column::Image",
        to = "super::document::Column::Id",
        on_update = "Cascade",
        on_delete = "Restrict"
    )]
    Document,
    #[sea_orm(has_many = "super::study::Entity")]
    Study,
}

impl Related<super::document::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Document.def()
    }
}

impl Related<super::study::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Study.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[tracing::instrument(skip(txn), ret, err)]
async fn try_delete_document(
    txn: &(impl ConnectionTrait + TransactionTrait),
    doc_id: i64,
) -> Result<(), crate::Error> {
    let result = txn
        .transaction::<_, _, crate::Error>(|txn| {
            Box::pin(async move {
                let result = super::document::Entity::delete_by_id(doc_id)
                    .exec(txn)
                    .await?;
                if result.rows_affected == 0 {
                    unreachable!(
                        "cannot happen as the Document has to be there because of the FK on `image`"
                    );
                }
                Ok(())
            })
        })
        .await
        .map_err(crate::Error::from);
    match result {
        Ok(_) => Ok(()),
        // We want the delete to occur in a transaction in order to rollback it if the deletion fails.
        // The deletion can fail if the document is still used by another project (FK violation). This
        // is acceptable, it's what this function does.
        // However, if a FK violation occurs, the transaction must rolloback otherwise each subsequent
        // query will fail. If the violation occurs, `e` is an `Err`, therefore we return it in order
        // to let `transaction` rollback. We then match on the error below in order to accept the
        // FK violation, which is not an error in our workflow.
        Err(error) if error.is_foreign_key_violation("project_image_id_fkey") => Ok(()),
        Err(error) => Err(error),
    }
}

#[derive(Debug, thiserror::Error, derive_more::From)]
pub enum Error {
    #[error("Project with id {project_id} not found")]
    NotFound { project_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
}

impl Model {
    /// Updates a project's image and deletes the old one if it is not used by another project
    #[tracing::instrument(skip(db), ret, err)]
    pub async fn update_and_prune_document(
        &mut self,
        db: Db,
        new_doc_id: Option<i64>,
    ) -> Result<(), crate::Error> {
        let project_id = self.id;
        let old_doc_id = self.image;
        self.image = new_doc_id;
        db.transaction::<_, _, crate::Error>(move |txn| {
            Box::pin(async move {
                ActiveModel {
                    id: Set(project_id),
                    image: Set(new_doc_id),
                    ..Default::default()
                }
                .update(txn)
                .await?;
                if new_doc_id != old_doc_id
                    && let Some(old_doc_id) = old_doc_id
                {
                    try_delete_document(txn, old_doc_id).await?;
                }
                Ok(())
            })
        })
        .await
        .map_err(Into::into)
    }

    /// Deletes a project and prunes the image if it is not used by another project
    #[tracing::instrument(skip(db), ret, err)]
    pub async fn delete_and_prune_document(self, db: Db) -> Result<(), crate::Error> {
        db.transaction::<_, _, crate::Error>(move |txn| {
            Box::pin(async move {
                let result = Entity::delete_by_id(self.id).exec(txn).await?;
                if result.rows_affected == 0 {
                    tracing::warn!(
                        project_id = self.id,
                        "project to delete not found, probable race condition"
                    );
                }
                if let Some(doc_id) = self.image {
                    try_delete_document(txn, doc_id).await?;
                }
                Ok(())
            })
        })
        .await
        .map_err(Into::into)
    }

    /// Opens a transaction querying a [Model] and calls the provided function with it
    ///
    /// The [Model::last_modification] field is updated to the current time after the function is called.
    #[tracing::instrument(skip(db, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        db: Db,
        project_id: i64,
        f: F,
    ) -> Result<Result<T, E>, Error>
    where
        F: for<'a> AsyncFnOnce(&'a DatabaseTransaction, Self) -> Result<T, E> + Send,
        T: Send,
        E: Send,
    {
        let txn = db.begin().await?;
        let project = Entity::find_by_id(project_id)
            .one(&txn)
            .await?
            .ok_or(Error::NotFound { project_id })?;
        let result = match f(&txn, project).await {
            Ok(result) => result,
            Err(error) => {
                txn.commit().await?;
                return Ok(Err(error));
            }
        };
        ActiveModel {
            id: Set(project_id),
            last_modification: Set(Utc::now()),
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
    pub fn fake(name: impl Into<String>) -> Self {
        Self {
            name: Set(name.into()),
            budget: Set(Some(0)),
            creation_date: Set(Utc::now()),
            last_modification: Set(Utc::now()),
            tags: Set(Tags::default()),
            ..Default::default()
        }
    }
}

#[cfg(test)]
pub mod tests {
    use database::Db;
    use pretty_assertions::assert_eq;
    use sea_orm::ActiveModelTrait as _;
    use sea_orm::EntityTrait as _;
    use sea_orm::IntoActiveModel as _;
    use sea_orm::QueryOrder as _;
    use sea_orm::Set;

    use crate::document;
    use crate::project;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_creation() {
        let db = Db::for_tests().await;
        let project_name = "test_project_name";
        let created_project = project::ActiveModel::fake(project_name)
            .insert(&db)
            .await
            .expect("Failed to create project");
        assert_eq!(created_project.name, project_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_retrieve() {
        let db = Db::for_tests().await;
        let created_project = project::ActiveModel::fake("test_project_name")
            .insert(&db)
            .await
            .expect("Failed to create project");

        // Get a project
        let project = project::Entity::find_by_id(created_project.id)
            .one(&db)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(&created_project, &project);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_update() {
        let db = Db::for_tests().await;
        let mut created_project = project::ActiveModel::fake("test_project_name")
            .insert(&db)
            .await
            .expect("Failed to create project");

        let project_name = "update_name";
        let project_budget = Some(1000);

        // Patch a project
        let mut active_project = created_project.into_active_model();
        active_project.name = Set(project_name.to_owned());
        active_project.budget = Set(project_budget);
        created_project = active_project
            .update(&db)
            .await
            .expect("Failed to update project");

        let project = project::Entity::find_by_id(created_project.id)
            .one(&db)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
        assert_eq!(project.budget, project_budget);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sort_project() {
        let db = Db::for_tests().await;
        project::ActiveModel::fake("test_project_name_1")
            .insert(&db)
            .await
            .expect("Failed to create project");
        project::ActiveModel::fake("test_project_name_2")
            .insert(&db)
            .await
            .expect("Failed to create project");

        let projects = project::Entity::find()
            .order_by_desc(project::Column::Name)
            .all(&db)
            .await
            .expect("Failed to retrieve projects");

        for (p1, p2) in projects.iter().zip(projects.iter().skip(1)) {
            let name_1 = p1.name.to_lowercase();
            let name_2 = p2.name.to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_project_prune_document() {
        let db = Db::for_tests().await;
        let mut project1 = project::ActiveModel::fake("Project 1")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let mut project2 = project::ActiveModel::fake("Project 2")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let image = document::ActiveModel {
            content_type: Set("data/text".to_owned()),
            data: Set(b"wassup?".to_vec()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create document");
        let image2 = document::ActiveModel {
            content_type: Set("data/text".to_owned()),
            data: Set(b"ohno".to_vec()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create document");

        project1
            .update_and_prune_document(db.clone(), Some(image.id))
            .await
            .expect("should work");
        project2
            .update_and_prune_document(db.clone(), Some(image.id))
            .await
            .expect("should work");

        project2
            .update_and_prune_document(db.clone(), None)
            .await
            .expect("should work - image is still used by project1");
        assert!(
            document::Entity::find_by_id(image.id)
                .one(&db)
                .await
                .unwrap()
                .is_some()
        );

        project1
            .update_and_prune_document(db.clone(), Some(image2.id))
            .await
            .expect("should work");
        assert!(
            document::Entity::find_by_id(image.id)
                .one(&db)
                .await
                .unwrap()
                .is_none(),
            "image should be deleted"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_project_prune_document() {
        let db = Db::for_tests().await;

        let mut project1 = project::ActiveModel::fake("Project 1")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let mut project2 = project::ActiveModel::fake("Project 2")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let mut project3 = project::ActiveModel::fake("Project 3")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let project4 = project::ActiveModel::fake("Project 4")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let image1 = document::ActiveModel {
            content_type: Set("data/text".to_owned()),
            data: Set(b"image 1".to_vec()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create document");
        let mut project1_active = project1.into_active_model();
        project1_active.image = Set(Some(image1.id));
        project1 = project1_active.update(&db).await.unwrap();
        let mut project2_active = project2.into_active_model();
        project2_active.image = Set(Some(image1.id));
        project2 = project2_active.update(&db).await.unwrap();
        let image2 = document::ActiveModel {
            content_type: Set("data/text".to_owned()),
            data: Set(b"image 2".to_vec()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create document");
        let mut project3_active = project3.into_active_model();
        project3_active.image = Set(Some(image2.id));
        project3 = project3_active.update(&db).await.unwrap();

        // project1 -> image1, project2 -> image1, project3 -> image2, project4 -> nothing

        let p1_id = project1.id;
        project1
            .delete_and_prune_document(db.clone())
            .await
            .expect("should work");
        assert!(
            document::Entity::find_by_id(image1.id)
                .one(&db)
                .await
                .unwrap()
                .is_some(),
            "image should not be deleted - still used by project2"
        );

        // project2 -> image1, project3 -> image2, project4 -> nothing

        let p3_id = project3.id;
        project3
            .delete_and_prune_document(db.clone())
            .await
            .expect("should work");
        assert!(
            document::Entity::find_by_id(image2.id)
                .one(&db)
                .await
                .unwrap()
                .is_none(),
            "image2 should be deleted"
        );

        // project2 -> image1, project4 -> nothing

        let p4_id = project4.id;
        project4
            .delete_and_prune_document(db.clone())
            .await
            .expect("should work");

        // project2 -> image1

        assert!(
            project::Entity::find_by_id(project2.id)
                .one(&db)
                .await
                .unwrap()
                .is_some()
        );
        assert!(
            document::Entity::find_by_id(image1.id)
                .one(&db)
                .await
                .unwrap()
                .is_some()
        );

        assert!(
            project::Entity::find_by_id(p1_id)
                .one(&db)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            project::Entity::find_by_id(p3_id)
                .one(&db)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            project::Entity::find_by_id(p4_id)
                .one(&db)
                .await
                .unwrap()
                .is_none()
        );
    }
}
