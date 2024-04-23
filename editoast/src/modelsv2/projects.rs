use actix_web::web::Data;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use chrono::Utc;
use diesel::sql_query;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::List;
use crate::modelsv2::Changeset;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::DeleteStatic;
use crate::modelsv2::Document;
use crate::modelsv2::Model;
use crate::modelsv2::Retrieve;
use crate::modelsv2::Row;
use crate::modelsv2::Save;
use crate::modelsv2::Update;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;
use crate::views::projects::ProjectError;

editoast_common::schemas! {
    Ordering,
    Project,
    Tags,
}

#[derive(Clone, Debug, Serialize, Deserialize, ModelV2, ToSchema, PartialEq)]
#[model(table = crate::tables::project)]
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
    #[model(column = crate::tables::project::image_id)]
    pub image: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema, PartialEq)]
pub struct Tags(Vec<String>);

impl Tags {
    pub fn new(value: Vec<String>) -> Self {
        Self(value)
    }
}

impl From<Vec<Option<String>>> for Tags {
    fn from(value: Vec<Option<String>>) -> Self {
        Self(value.into_iter().flatten().collect())
    }
}

impl From<Tags> for Vec<Option<String>> {
    fn from(value: Tags) -> Self {
        value.0.into_iter().map(Some).collect()
    }
}

#[derive(Debug, Clone, Deserialize, Default, ToSchema)]
pub enum Ordering {
    NameAsc,
    NameDesc,
    CreationDateAsc,
    CreationDateDesc,
    #[default]
    LastModifiedDesc,
    LastModifiedAsc,
}

impl Ordering {
    pub fn to_sql(&self) -> &str {
        match *self {
            Ordering::NameAsc => "LOWER(t.name) ASC",
            Ordering::NameDesc => " LOWER(t.name) DESC",
            Ordering::CreationDateAsc => "creation_date",
            Ordering::CreationDateDesc => "creation_date DESC",
            Ordering::LastModifiedAsc => "last_modification",
            Ordering::LastModifiedDesc => "last_modification DESC",
        }
    }
}

impl Project {
    /// This function takes a filled project and update to now the last_modification field
    pub async fn update_last_modified(&mut self, conn: &mut DbConnection) -> Result<()> {
        self.last_modification = Utc::now().naive_utc();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn studies_count(&self, db_pool: Data<DbConnectionPool>) -> Result<i64> {
        use crate::tables::study::dsl as study_dsl;
        let conn = &mut db_pool.get().await?;
        let studies_count = study_dsl::study
            .filter(study_dsl::project_id.eq(self.id))
            .count()
            .get_result(conn)
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

#[async_trait]
impl List<Ordering> for Project {
    async fn list_conn(
        conn: &mut DbConnection,
        page: i64,
        page_size: i64,
        ordering: Ordering,
    ) -> Result<PaginatedResponse<Self>> {
        let ordering = ordering.to_sql();
        let project_rows = sql_query(format!("SELECT t.* FROM project as t ORDER BY {ordering}"))
            .paginate(page, page_size)
            .load_and_count::<Row<Project>>(conn)
            .await?;

        let results: Vec<Project> = project_rows
            .results
            .into_iter()
            .map(Self::from_row)
            .collect();

        Ok(PaginatedResponse {
            count: project_rows.count,
            previous: project_rows.previous,
            next: project_rows.next,
            results,
        })
    }
}

#[cfg(test)]
pub mod test {
    use actix_web::web::Data;
    use rstest::rstest;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::project;
    use crate::fixtures::tests::TestFixture;
    use crate::models::List;
    use crate::modelsv2::DeleteStatic;
    use crate::modelsv2::Model;
    use crate::modelsv2::Ordering;
    use crate::modelsv2::Retrieve;

    #[rstest]
    async fn create_delete_project(
        #[future] project: TestFixture<Project>,
        db_pool: Data<DbConnectionPool>,
    ) {
        let project = project.await;
        let conn = &mut db_pool.get().await.unwrap();
        // Delete the project
        assert!(Project::delete_static(conn, project.id()).await.unwrap());
        // Second delete should be false
        assert!(!Project::delete_static(conn, project.id()).await.unwrap());
    }

    #[rstest]
    async fn get_project(#[future] project: TestFixture<Project>, db_pool: Data<DbConnectionPool>) {
        let fixture_project = &project.await.model;
        let conn = &mut db_pool.get().await.unwrap();

        // Get a project
        let project = Project::retrieve(conn, fixture_project.id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(fixture_project, &project);
        assert!(
            Project::list(db_pool.clone(), 1, 25, Ordering::LastModifiedAsc)
                .await
                .is_ok()
        );
    }

    #[rstest]
    async fn sort_project(
        #[future] project: TestFixture<Project>,
        db_pool: Data<DbConnectionPool>,
    ) {
        let project = project.await;
        let project_2 = project
            .model
            .clone()
            .into_changeset()
            .name(project.model.name.clone() + "_bis");

        let _: TestFixture<Project> = TestFixture::create(project_2, db_pool.clone()).await;

        let projects = Project::list(db_pool.clone(), 1, 25, Ordering::NameDesc)
            .await
            .unwrap()
            .results;

        for (p1, p2) in projects.iter().zip(projects.iter().skip(1)) {
            let name_1 = p1.name.to_lowercase();
            let name_2 = p2.name.to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }

    #[rstest]
    async fn update_project(
        #[future] project: TestFixture<Project>,
        db_pool: Data<DbConnectionPool>,
    ) {
        let project_fixture = project.await;
        let conn = &mut db_pool.get().await.unwrap();

        // Patch a project
        let mut project = project_fixture.model.clone();
        project.name = "update_name".into();
        project.budget = Some(1000);
        project.save(conn).await.unwrap();
        let project = Project::retrieve(conn, project.id).await.unwrap().unwrap();
        assert_eq!(project.name, String::from("update_name"));
    }
}
