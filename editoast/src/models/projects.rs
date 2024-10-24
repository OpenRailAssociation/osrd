use chrono::NaiveDateTime;
use chrono::Utc;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::prelude::*;
use crate::models::Document;
use crate::models::Study;
use crate::models::Tags;
use crate::views::projects::ProjectError;
use crate::SelectionSettings;
use editoast_models::DbConnection;

editoast_common::schemas! {
    Project,
}

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq)]
#[model(table = editoast_models::tables::project)]
#[model(gen(ops = crud, list))]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub objectives: Option<String>,
    pub description: Option<String>,
    pub funders: Option<String>,
    pub budget: Option<i32>,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
    #[model(column = editoast_models::tables::project::image_id)]
    pub image: Option<i64>,
}

impl Project {
    /// This function takes a filled project and update to now the last_modification field
    pub async fn update_last_modified(&mut self, conn: &mut DbConnection) -> Result<()> {
        self.last_modification = Utc::now().naive_utc();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn studies_count(&self, conn: &mut DbConnection) -> Result<u64> {
        let project_id = self.id;
        let studies_count = Study::count(
            conn,
            SelectionSettings::new().filter(move || Study::PROJECT_ID.eq(project_id)),
        )
        .await?;
        Ok(studies_count)
    }

    pub async fn update_and_prune_document(
        conn: &mut DbConnection,
        project_changeset: Changeset<Self>,
        project_id: i64,
    ) -> Result<Project> {
        let old_project =
            Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
                .await?;
        let image_to_delete = if Some(old_project.image) != project_changeset.image {
            old_project.image
        } else {
            None
        };
        let project = project_changeset
            .update_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
        if let Some(image) = image_to_delete {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_static(conn, image).await;
        }
        Ok(project)
    }

    pub async fn delete_and_prune_document(
        conn: &mut DbConnection,
        project_id: i64,
    ) -> Result<bool> {
        let project_obj =
            Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
                .await?;
        let _ = Project::delete_static(conn, project_id).await?;

        if let Some(image) = project_obj.image {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_static(conn, image).await;
        }

        Ok(true)
    }
}

#[cfg(test)]
pub mod test {
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::models::fixtures::create_project;
    use crate::models::prelude::*;
    use crate::models::Model;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn project_creation() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let project_name = "test_project_name";
        let created_project = create_project(&mut db_pool.get_ok(), project_name).await;
        assert_eq!(created_project.name, project_name);
    }

    #[rstest]
    async fn project_retrieve() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        // Get a project
        let project = Project::retrieve(&mut db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(&created_project, &project);
    }

    #[rstest]
    async fn project_update() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let project_name = "update_name";
        let project_budget = Some(1000);

        // Patch a project
        created_project
            .patch()
            .name(project_name.to_owned())
            .budget(project_budget)
            .apply(&mut db_pool.get_ok())
            .await
            .expect("Failed to update project");

        let project = Project::retrieve(&mut db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
        assert_eq!(project.budget, project_budget);
    }

    #[rstest]
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
}
