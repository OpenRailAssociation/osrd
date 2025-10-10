use chrono::DateTime;
use chrono::Utc;
use database::DbConnection;
use diesel_async::scoped_futures::ScopedBoxFuture;
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_derive::Model;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::models::Study;
use crate::views::project::ProjectError;
use editoast_models::Document;
use editoast_models::tags::Tags;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq)]
#[model(table = database::tables::project)]
#[model(gen(ops = crud, list))]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub objectives: Option<String>,
    pub description: Option<String>,
    pub funders: Option<String>,
    pub budget: Option<i32>,
    pub creation_date: DateTime<Utc>,
    pub last_modification: DateTime<Utc>,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
    #[model(column = database::tables::project::image_id)]
    pub image: Option<i64>,
}

#[tracing::instrument(skip(conn), ret, err)]
async fn try_delete_document(
    conn: &DbConnection,
    doc_id: i64,
) -> Result<(), editoast_models::Error> {
    let res = conn
        .transaction(|mut conn| {
            async move {
                match Document::delete_static(&mut conn, doc_id).await {
                    Ok(false) => unreachable!(
                        "cannot happen as the Document has to be there because of the FK on `image`"
                    ),
                    Ok(true) => Ok(()),
                    // We want the delete to occur in a transaction in order to rollback it if the deletion fails.
                    // The deletion can fail if the document is still used by another project (FK violation). This
                    // is acceptable, it's what this function does.
                    // However, if a FK violation occurs, the transaction must rolloback otherwise each subsequent
                    // query will fail. If the violation occurs, `e` is an `Err`, therefore we return it in order
                    // to let `transaction` rollback. We then match on the error below in order to accept the
                    // FK violation, which is not an error in our workflow.
                    Err(e) => Err(e),
                }
            }
            .scope_boxed()
        })
        .await;
    match res {
        Ok(_) => Ok(()),
        Err(editoast_models::Error::ForeignKeyViolation { constraint })
            if constraint == "project_image_id_fkey" =>
        {
            Ok(())
        }
        Err(e) => Err(e),
    }
}

impl Project {
    /// This function takes a filled project and update to now the last_modification field
    pub async fn update_last_modified(
        &mut self,
        conn: &mut DbConnection,
    ) -> Result<(), editoast_models::Error> {
        self.last_modification = Utc::now();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn studies_count(&self, conn: &mut DbConnection) -> Result<u64, InternalError> {
        let project_id = self.id;
        let studies_count = Study::count(
            conn,
            SelectionSettings::new().filter(move || Study::PROJECT_ID.eq(project_id)),
        )
        .await?;
        Ok(studies_count)
    }

    /// Updates a project's image and deletes the old one if it is not used by another project
    #[tracing::instrument(skip(conn), ret, err)]
    pub async fn update_and_prune_document(
        &mut self,
        conn: &mut DbConnection,
        new_doc_id: Option<i64>,
    ) -> Result<(), editoast_models::Error> {
        conn.transaction(|mut conn| {
            async move {
                let old_doc_id = self.image;
                self.image = new_doc_id;
                self.save(&mut conn).await?;
                if new_doc_id != old_doc_id
                    && let Some(old_doc_id) = old_doc_id
                {
                    try_delete_document(&conn, old_doc_id).await?;
                }
                Ok::<_, editoast_models::Error>(())
            }
            .scope_boxed()
        })
        .await?;
        Ok(())
    }

    /// Deletes a project and prunes the image if it is not used by another project
    #[tracing::instrument(skip(conn), ret, err)]
    pub async fn delete_and_prune_document(
        self,
        conn: &mut DbConnection,
    ) -> Result<(), editoast_models::Error> {
        conn.transaction(|mut conn| {
            async move {
                if !self.delete(&mut conn).await? {
                    tracing::warn!(
                        project_id = self.id,
                        "project to delete not found, probable race condition"
                    );
                }
                if let Some(doc_id) = self.image {
                    try_delete_document(&conn, doc_id).await?;
                }
                Ok(())
            }
            .scope_boxed()
        })
        .await
    }

    /// Opens a transaction querying a [Project] and calls the provided function with it
    ///
    /// The [Project::last_modification] field is updated to the current time after the function is called.
    #[tracing::instrument(skip(conn, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        conn: DbConnection,
        project_id: i64,
        f: F,
    ) -> Result<T, InternalError>
    where
        T: Send,
        E: Into<InternalError> + Send, // EditoastError bound will be removed when retrieve will return the model's error
        F: FnOnce(DbConnection, Self) -> ScopedBoxFuture<'static, 'static, Result<T, E>> + Send,
    {
        conn.transaction(|mut conn| {
            async move {
                let project = Self::retrieve_or_fail(conn.clone(), project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;

                let id = project.id;
                let res = f(conn.clone(), project).await;

                Project::changeset()
                    .last_modification(Utc::now())
                    .update(&mut conn, id)
                    .await?;

                res.map_err(Into::into)
            }
            .scope_boxed()
        })
        .await
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    use database::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;

    use crate::models::fixtures::create_project;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_creation() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let project_name = "test_project_name";
        let created_project = create_project(&mut db_pool.get_ok(), project_name).await;
        assert_eq!(created_project.name, project_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_retrieve() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        // Get a project
        let project = Project::retrieve(db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(&created_project, &project);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_update() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let project_name = "update_name";
        let project_budget = Some(1000);

        // Patch a project
        created_project.name = project_name.to_owned();
        created_project.budget = project_budget;
        created_project
            .save(&mut db_pool.get_ok())
            .await
            .expect("Failed to update project");

        let project = Project::retrieve(db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
        assert_eq!(project.budget, project_budget);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sort_project() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let _created_project_1 = create_project(&mut db_pool.get_ok(), "test_project_name_1").await;
        let _created_project_2 = create_project(&mut db_pool.get_ok(), "test_project_name_2").await;

        let projects = Project::list(
            &mut db_pool.get_ok(),
            SelectionSettings::new().order_by(|| Project::NAME.desc()),
        )
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
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut project1 = create_project(&mut db_pool.get_ok(), "Project 1").await;
        let mut project2 = create_project(&mut db_pool.get_ok(), "Project 2").await;
        let image = Document::changeset()
            .content_type("data/text".to_owned())
            .data("wassup?".bytes().collect())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        let image2 = Document::changeset()
            .content_type("data/text".to_owned())
            .data("ohno".bytes().collect())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();

        project1
            .update_and_prune_document(&mut db_pool.get_ok(), Some(image.id))
            .await
            .expect("should work");
        project2
            .update_and_prune_document(&mut db_pool.get_ok(), Some(image.id))
            .await
            .expect("should work");

        project2
            .update_and_prune_document(&mut db_pool.get_ok(), None)
            .await
            .expect("should work - image is still used by project1");
        assert!(
            Document::exists(&mut db_pool.get_ok(), image.id)
                .await
                .unwrap()
        );

        project1
            .update_and_prune_document(&mut db_pool.get_ok(), Some(image2.id))
            .await
            .expect("should work");
        assert!(
            !Document::exists(&mut db_pool.get_ok(), image.id)
                .await
                .unwrap(),
            "image should be deleted"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_project_prune_document() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let mut project1 = create_project(&mut db_pool.get_ok(), "Project 1").await;
        let mut project2 = create_project(&mut db_pool.get_ok(), "Project 2").await;
        let mut project3 = create_project(&mut db_pool.get_ok(), "Project 3").await;
        let project4 = create_project(&mut db_pool.get_ok(), "Project 4").await;
        let image1 = Document::changeset()
            .content_type("data/text".to_owned())
            .data("image 1".bytes().collect())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        project1.image = Some(image1.id);
        project1.save(&mut db_pool.get_ok()).await.unwrap();
        project2.image = Some(image1.id);
        project2.save(&mut db_pool.get_ok()).await.unwrap();
        let image2 = Document::changeset()
            .content_type("data/text".to_owned())
            .data("image 2".bytes().collect())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        project3.image = Some(image2.id);
        project3.save(&mut db_pool.get_ok()).await.unwrap();

        // project1 -> image1, project2 -> image1, project3 -> image2, project4 -> nothing

        let p1_id = project1.id;
        project1
            .delete_and_prune_document(&mut db_pool.get_ok())
            .await
            .expect("should work");
        assert!(
            Document::exists(&mut db_pool.get_ok(), image1.id)
                .await
                .unwrap(),
            "image should not be deleted - still used by project2"
        );

        // project2 -> image1, project3 -> image2, project4 -> nothing

        let p3_id = project3.id;
        project3
            .delete_and_prune_document(&mut db_pool.get_ok())
            .await
            .expect("should work");
        assert!(
            !Document::exists(&mut db_pool.get_ok(), image2.id)
                .await
                .unwrap(),
            "image2 should be deleted"
        );

        // project2 -> image1, project4 -> nothing

        let p4_id = project4.id;
        project4
            .delete_and_prune_document(&mut db_pool.get_ok())
            .await
            .expect("should work");

        // project2 -> image1

        assert!(
            Project::exists(&mut db_pool.get_ok(), project2.id)
                .await
                .unwrap()
        );
        assert!(
            Document::exists(&mut db_pool.get_ok(), image1.id)
                .await
                .unwrap()
        );

        assert!(!Project::exists(&mut db_pool.get_ok(), p1_id).await.unwrap());
        assert!(!Project::exists(&mut db_pool.get_ok(), p3_id).await.unwrap());
        assert!(!Project::exists(&mut db_pool.get_ok(), p4_id).await.unwrap());
    }
}
