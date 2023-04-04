use super::{List, NoParams, Update};
use crate::error::Result;
use crate::models::Identifiable;
use crate::models::{Delete, Document, Retrieve};
use crate::tables::osrd_infra_project;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, BigInt};
use diesel::{delete, sql_query, update, QueryDsl, RunQueryDsl};
use diesel::{ExpressionMethods, PgConnection};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Clone,
    Debug,
    Serialize,
    Deserialize,
    Insertable,
    Derivative,
    Queryable,
    QueryableByName,
    AsChangeset,
    Identifiable,
    Model,
)]
#[derivative(Default)]
#[model(table = "osrd_infra_project")]
#[model(create, retrieve)]
#[diesel(table_name = osrd_infra_project)]
pub struct Project {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    pub description: Option<String>,
    #[diesel(deserialize_as = String)]
    pub objectives: Option<String>,
    #[diesel(deserialize_as = String)]
    pub funders: Option<String>,
    #[diesel(deserialize_as = i32)]
    pub budget: Option<i32>,
    #[diesel(deserialize_as = Option<i64>)]
    #[diesel(column_name = "image_id")]
    pub image: Option<Option<i64>>,
    #[diesel(deserialize_as = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = Vec<String>)]
    pub tags: Option<Vec<String>>,
}

impl Identifiable for Project {
    fn get_id(&self) -> i64 {
        self.id.expect("Id not found")
    }
}

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct ProjectWithStudies {
    #[serde(flatten)]
    #[diesel(embed)]
    pub project: Project,
    #[diesel(sql_type = Array<BigInt>)]
    pub studies: Vec<i64>,
}

impl Project {
    /// This function takes a filled project and update to now the last_modification field
    pub async fn update_last_modified(mut self, db_pool: Data<DbPool>) -> Result<Option<Project>> {
        self.last_modification = Utc::now().naive_utc();
        self.update(db_pool).await
    }

    pub async fn with_studies(self, db_pool: Data<DbPool>) -> Result<ProjectWithStudies> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_study::dsl as study_dsl;
            let mut conn = db_pool.get()?;
            let studies = study_dsl::osrd_infra_study
                .filter(study_dsl::project_id.eq(self.id.unwrap()))
                .select(study_dsl::id)
                .load(&mut conn)?;
            Ok(ProjectWithStudies {
                project: self,
                studies,
            })
        })
        .await
        .unwrap()
    }

    /// Update a project. If the image is changed, the old image is deleted.
    /// If the image is not found, return `None`.
    /// If the project id is `None` this functions panic.
    pub async fn update(self, db_pool: Data<DbPool>) -> Result<Option<Project>> {
        let project_id = self.id.expect("Project id is None");
        let project = match Project::retrieve(db_pool.clone(), project_id).await? {
            Some(project) => project,
            None => return Ok(None),
        };
        let image_to_delete = if project.image != self.image {
            project.image.unwrap()
        } else {
            None
        };

        let db_pool_ref = db_pool.clone();
        let project = block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_project::dsl::*;
            let mut conn = db_pool_ref.get()?;
            match update(osrd_infra_project.find(project_id))
                .set(&self)
                .get_result::<Project>(&mut conn)
            {
                Ok(project) => Ok(project),
                Err(DieselError::NotFound) => panic!("Project should exist"),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()?;

        if let Some(image) = image_to_delete {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete(db_pool, image).await;
        }

        Ok(Some(project))
    }
}

impl Delete for Project {
    fn delete_conn(conn: &mut diesel::PgConnection, project_id: i64) -> Result<bool> {
        use crate::tables::osrd_infra_project::dsl::*;
        // Delete project
        let project = match delete(osrd_infra_project.filter(id.eq(project_id)))
            .get_result::<Project>(conn)
        {
            Ok(project) => project,
            Err(DieselError::NotFound) => return Ok(false),
            Err(err) => return Err(err.into()),
        };
        // Delete image if any
        if let Some(image) = project.image.unwrap() {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_conn(conn, image);
        };
        Ok(true)
    }
}

impl Update for Project {
    /// Update a project. If the image is changed, the old image is deleted.
    /// If the image is not found, return `None`.
    fn update_conn(self, conn: &mut diesel::PgConnection, project_id: i64) -> Result<Option<Self>> {
        let project = match Project::retrieve_conn(conn, project_id)? {
            Some(project) => project,
            None => return Ok(None),
        };
        let image_to_delete = if project.image != self.image {
            project.image.unwrap()
        } else {
            None
        };

        use crate::tables::osrd_infra_project::dsl::osrd_infra_project;
        let project = update(osrd_infra_project.find(project_id))
            .set(&self)
            .get_result::<Project>(conn)?;

        if let Some(image) = image_to_delete {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete_conn(conn, image);
        }

        Ok(Some(project))
    }
}

impl List<NoParams> for ProjectWithStudies {
    fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        _: NoParams,
    ) -> Result<PaginatedResponse<Self>> {
        sql_query(
            "SELECT project.*, COALESCE(ARRAY_AGG(study.id) FILTER (WHERE study.id is not NULL), ARRAY[]::bigint[])  as studies FROM osrd_infra_project project
            LEFT JOIN osrd_infra_study study ON study.project_id = project.id
            GROUP BY project.id"
        )
        .paginate(page, page_size)
        .load_and_count(conn)
    }
}

#[cfg(test)]
pub mod test {
    use super::Project;
    use crate::fixtures::tests::TestFixture;
    use crate::fixtures::tests::{db_pool, project};
    use crate::models::{List, NoParams, ProjectWithStudies, Retrieve};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use rstest::rstest;

    #[rstest]
    async fn create_delete_project(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] project: TestFixture<Project>,
    ) {
        let project_id: i64;
        {
            let project = project.await;
            project_id = project.id();
            assert_eq!(
                "_@Test integration project",
                project.model.name.clone().unwrap()
            );
        }
        assert!(Project::retrieve(db_pool, project_id)
            .await
            .unwrap()
            .is_none());
    }

    #[rstest]
    async fn get_project(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] project: TestFixture<Project>,
    ) {
        let project = project.await;
        assert!(Project::retrieve(db_pool.clone(), project.id())
            .await
            .unwrap()
            .is_some());
        assert!(ProjectWithStudies::list(db_pool.clone(), 1, 25, NoParams)
            .await
            .is_ok());
    }

    #[rstest]
    async fn update_project(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] project: TestFixture<Project>,
    ) {
        let project_fixture = project.await;
        let mut project = Project::retrieve(db_pool.clone(), project_fixture.id())
            .await
            .unwrap()
            .unwrap();

        project.name = Some("update_name".into());
        project.budget = Some(1000);
        let project_updated = project.update(db_pool.clone()).await.unwrap().unwrap();
        assert_eq!(project_updated.name.unwrap(), String::from("update_name"));
    }
}
