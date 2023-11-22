use crate::error::Result;
use crate::models::TextArray;
use crate::models::{Delete, Identifiable, Retrieve};
use crate::modelsv2::{DeleteStatic, Document};
use crate::tables::project;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::Data;
use async_trait::async_trait;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_types::BigInt;
use diesel::{delete, sql_query, update, ExpressionMethods, QueryDsl};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::{List, Update};

crate::schemas! {
    Ordering,
    ProjectWithStudies,
    Project,
}

#[derive(
    Clone,
    Debug,
    Serialize,
    Deserialize,
    Insertable,
    Derivative,
    Queryable,
    QueryableByName,
    Identifiable,
    AsChangeset,
    Model,
    ToSchema,
)]
#[derivative(Default)]
#[model(table = "project")]
#[model(create, retrieve)]
#[diesel(table_name = project)]
pub struct Project {
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub id: Option<i64>,

    #[diesel(deserialize_as = String)]
    #[schema(value_type = String)]
    pub name: Option<String>,

    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub objectives: Option<String>,

    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub description: Option<String>,

    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub funders: Option<String>,

    #[diesel(deserialize_as = i32)]
    #[derivative(Default(value = "Some(0)"))]
    #[schema(value_type = i32)]
    pub budget: Option<i32>,

    #[diesel(deserialize_as = NaiveDateTime)]
    #[schema(value_type = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,

    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    #[diesel(deserialize_as = NaiveDateTime)]
    pub last_modification: NaiveDateTime,

    #[diesel(deserialize_as = TextArray)]
    #[derivative(Default(value = "Some(Vec::new())"))]
    #[schema(value_type = Vec<String>)]
    pub tags: Option<Vec<String>>,

    #[diesel(deserialize_as = Option<i64>)]
    #[diesel(column_name = "image_id")]
    #[schema(value_type = Option<i64>)]
    pub image: Option<Option<i64>>,
}

impl Identifiable for Project {
    fn get_id(&self) -> i64 {
        self.id.expect("Project id not found")
    }
}
#[derive(Debug, Clone, Serialize, QueryableByName, ToSchema)]
pub struct ProjectWithStudies {
    #[serde(flatten)]
    #[diesel(embed)]
    pub project: Project,
    #[diesel(sql_type = BigInt)]
    pub studies_count: i64,
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
    pub async fn update_last_modified(self, db_pool: Data<DbPool>) -> Result<Option<Project>> {
        let mut conn = db_pool.get().await?;
        self.update_last_modified_conn(&mut conn).await
    }

    pub async fn update_last_modified_conn(
        mut self,
        conn: &mut PgConnection,
    ) -> Result<Option<Project>> {
        self.last_modification = Utc::now().naive_utc();
        self.update_conn(conn).await
    }

    pub async fn with_studies(self, db_pool: Data<DbPool>) -> Result<ProjectWithStudies> {
        use crate::tables::study::dsl as study_dsl;
        let mut conn = db_pool.get().await?;
        let studies_count = study_dsl::study
            .filter(study_dsl::project_id.eq(self.id.unwrap()))
            .count()
            .get_result(&mut conn)
            .await?;
        Ok(ProjectWithStudies {
            project: self,
            studies_count,
        })
    }

    /// Update a project. If the image is changed, the old image is deleted.
    /// If the image is not found, return `None`.
    /// If the project id is `None` this function panics.
    pub async fn update(self, db_pool: Data<DbPool>) -> Result<Option<Project>> {
        let mut conn = db_pool.get().await?;
        self.update_conn(&mut conn).await
    }

    pub async fn update_conn(self, conn: &mut PgConnection) -> Result<Option<Project>> {
        let project_id = self.id.expect("Project id is None");
        let project_obj = match Project::retrieve_conn(conn, project_id).await? {
            Some(project_obj) => project_obj,
            None => return Ok(None),
        };
        let image_to_delete = if project_obj.image != self.image {
            project_obj.image.unwrap()
        } else {
            None
        };

        use crate::tables::project::dsl::*;
        let project_obj = update(project.find(project_id))
            .set(&self)
            .get_result::<Project>(conn)
            .await
            .map_err(|err| match err {
                DieselError::NotFound => panic!("Project should exist"),
                e => e,
            })?;

        if let Some(image) = image_to_delete {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_static(conn, image).await;
        }

        Ok(Some(project_obj))
    }
}

#[async_trait]
impl Delete for Project {
    async fn delete_conn(conn: &mut PgConnection, project_id: i64) -> Result<bool> {
        use crate::tables::project::dsl::*;
        // Delete project
        let project_obj = match delete(project.filter(id.eq(project_id)))
            .get_result::<Project>(conn)
            .await
        {
            Ok(project_obj) => project_obj,
            Err(DieselError::NotFound) => return Ok(false),
            Err(err) => return Err(err.into()),
        };
        // Delete image if any
        if let Some(image) = project_obj.image.unwrap() {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_static(conn, image).await;
        };
        Ok(true)
    }
}

#[async_trait]
impl Update for Project {
    /// Update a project. If the image is changed, the old image is deleted.
    /// If the image is not found, return `None`.
    async fn update_conn(self, conn: &mut PgConnection, project_id: i64) -> Result<Option<Self>> {
        let project_obj = match Project::retrieve_conn(conn, project_id).await? {
            Some(project_obj) => project_obj,
            None => return Ok(None),
        };
        let image_to_delete = if project_obj.image != self.image {
            project_obj.image.unwrap()
        } else {
            None
        };

        use crate::tables::project::dsl::project;
        let project_obj = update(project.find(project_id))
            .set(&self)
            .get_result::<Project>(conn)
            .await?;

        if let Some(image) = image_to_delete {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_static(conn, image).await;
        }

        Ok(Some(project_obj))
    }
}

#[async_trait]
impl List<Ordering> for ProjectWithStudies {
    async fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        ordering: Ordering,
    ) -> Result<PaginatedResponse<Self>> {
        let ordering = ordering.to_sql();
        sql_query(format!(
            "SELECT t.*, COUNT(study.*) as studies_count FROM project as t
            LEFT JOIN study ON study.project_id = t.id
            GROUP BY t.id ORDER BY {ordering}"
        ))
        .paginate(page, page_size)
        .load_and_count(conn)
        .await
    }
}

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{db_pool, project, TestFixture};
    use crate::models::{Delete, List, Ordering, ProjectWithStudies, Retrieve};
    use actix_web::web::Data;
    use rstest::rstest;

    #[rstest]
    async fn create_delete_project(#[future] project: TestFixture<Project>, db_pool: Data<DbPool>) {
        let project = project.await;
        // Delete the project
        assert!(Project::delete(db_pool.clone(), project.id())
            .await
            .unwrap());
        // Second delete should be false
        assert!(!Project::delete(db_pool, project.id()).await.unwrap());
    }

    #[rstest]
    async fn get_project(#[future] project: TestFixture<Project>, db_pool: Data<DbPool>) {
        let project = project.await;

        // Get a project
        assert!(Project::retrieve(db_pool.clone(), project.id())
            .await
            .unwrap()
            .is_some());
        assert!(
            ProjectWithStudies::list(db_pool.clone(), 1, 25, Ordering::LastModifiedAsc)
                .await
                .is_ok()
        );
    }

    #[rstest]
    async fn sort_project(#[future] project: TestFixture<Project>, db_pool: Data<DbPool>) {
        let project = project.await;

        // Create second project
        let project_2 = Project {
            name: Some(project.model.name.clone().unwrap() + "_bis"),
            id: None,
            ..project.model.clone()
        };
        let _project_2 = TestFixture::create(project_2, db_pool.clone()).await;

        let projects = ProjectWithStudies::list(db_pool.clone(), 1, 25, Ordering::NameDesc)
            .await
            .unwrap()
            .results;

        for (p1, p2) in projects.iter().zip(projects.iter().skip(1)) {
            let name_1 = p1.project.name.as_ref().unwrap().to_lowercase();
            let name_2 = p2.project.name.as_ref().unwrap().to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }

    #[rstest]
    async fn update_project(#[future] project: TestFixture<Project>, db_pool: Data<DbPool>) {
        let project_fixture = project.await;

        // Patch a project
        let mut project = project_fixture.model.clone();
        project.name = Some("update_name".into());
        project.budget = Some(1000);
        let project_updated = project.update(db_pool).await.unwrap().unwrap();
        assert_eq!(project_updated.name.unwrap(), String::from("update_name"));
    }
}
