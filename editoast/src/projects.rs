use crate::documents::Document;
use crate::error::{InternalError, Result};
use crate::tables::osrd_infra_project;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, BigInt};
use diesel::{delete, sql_query, update, QueryDsl, RunQueryDsl};
use diesel::{insert_into, ExpressionMethods};
use editoast_derive::EditoastError;
use image::ImageError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "project")]
pub enum ProjectError {
    /// Couldn't found the project with the given id
    #[error("Project '{project_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { project_id: i64 },
    // Couldn't found the project with the given id
    #[error("The provided image is not valid : {0}")]
    ImageError(ImageError),
}

#[derive(
    Clone, QueryableByName, Queryable, Debug, Serialize, Deserialize, AsChangeset, Identifiable,
)]
#[diesel(table_name = osrd_infra_project)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image_id: Option<i64>,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct ProjectWithStudies {
    #[serde(flatten)]
    #[diesel(embed)]
    pub project: Project,
    #[diesel(sql_type = Array<BigInt>)]
    pub studies: Vec<i64>,
}

/// This structure is used by the post endpoint to create a project
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
pub struct ProjectCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub objectives: String,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image: Option<i64>,
    pub tags: Option<Vec<String>>,
}

/// This structure is used to insert data into the database when creating the project
#[derive(Insertable, Derivative)]
#[derivative(Default)]
#[diesel(table_name = osrd_infra_project)]
struct ProjectCreatePayload {
    pub name: String,
    pub description: String,
    pub objectives: String,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub creation_date: NaiveDateTime,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    pub image_id: Option<i64>,
    pub tags: Option<Vec<String>>,
}

impl From<ProjectCreateForm> for ProjectCreatePayload {
    fn from(project: ProjectCreateForm) -> Self {
        ProjectCreatePayload {
            name: project.name,
            description: project.description,
            objectives: project.objectives,
            funders: project.funders,
            budget: project.budget,
            image_id: project.image,
            tags: project.tags,
            ..Default::default()
        }
    }
}

/// This structure is used by the patch endpoint to patch a project
#[derive(Serialize, Deserialize)]
pub struct ProjectPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image_id: Option<i64>,
    pub tags: Option<Vec<String>>,
}

/// This structure is used to overwrite data into the database when patching a project
#[derive(AsChangeset, Derivative)]
#[derivative(Default)]
#[diesel(table_name = osrd_infra_project)]
struct ProjectPatchPayload {
    pub name: Option<String>,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    pub image_id: Option<Option<i64>>,
    pub tags: Option<Vec<String>>,
}

impl From<ProjectPatchForm> for ProjectPatchPayload {
    fn from(project: ProjectPatchForm) -> Self {
        ProjectPatchPayload {
            name: project.name,
            description: project.description,
            objectives: project.objectives,
            funders: project.funders,
            budget: project.budget,
            image_id: Some(project.image_id),
            tags: project.tags,
            ..Default::default()
        }
    }
}

async fn check_image_content(db_pool: Data<DbPool>, document_key: i64) -> Result<()> {
    let doc: Document = Document::load(db_pool, document_key).await?;
    match image::load_from_memory(&doc.inner_data()) {
        Ok(_) => Ok(()),
        Err(e) => Err(ProjectError::ImageError(e).into()),
    }
}

impl Project {
    pub async fn create(
        data: ProjectCreateForm,
        db_pool: Data<DbPool>,
    ) -> Result<ProjectWithStudies> {
        if let Some(image) = data.image {
            check_image_content(db_pool.clone(), image).await?;
        }
        let project_payload: ProjectCreatePayload = data.into();
        let project = block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_project::dsl::*;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match insert_into(osrd_infra_project)
                .values(&project_payload)
                .get_result::<Project>(&mut conn)
            {
                Ok(project) => Ok(project),
                Err(error) => Err(error.into()),
            }
        })
        .await
        .unwrap()?;
        Ok(ProjectWithStudies {
            project,
            studies: vec![],
        })
    }

    pub async fn list(
        db_pool: Data<DbPool>,
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedResponse<ProjectWithStudies>> {
        sql_query(
            "SELECT project.*, COALESCE(ARRAY_AGG(study.id) FILTER (WHERE study.id is not NULL), ARRAY[]::bigint[])  as studies FROM osrd_infra_project project
            LEFT JOIN osrd_infra_study study ON study.project_id = project.id
            GROUP BY project.id"
        )
        .paginate(page)
        .per_page(per_page)
        .load_and_count(db_pool)
        .await
    }

    pub async fn retrieve(db_pool: Data<DbPool>, project_id: i64) -> Result<ProjectWithStudies> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_project::dsl as project_dsl;
            use crate::tables::osrd_infra_study::dsl as study_dsl;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            let project = match project_dsl::osrd_infra_project
                .find(project_id)
                .first(&mut conn)
            {
                Ok(project) => Ok(project),
                Err(DieselError::NotFound) => Err(ProjectError::NotFound { project_id }.into()),
                Err(e) => Err(InternalError::from(e)),
            }?;
            let studies = match study_dsl::osrd_infra_study
                .filter(study_dsl::project_id.eq(project_id))
                .select(study_dsl::id)
                .load(&mut conn)
            {
                Ok(studies) => Ok(studies),
                Err(e) => Err(InternalError::from(e)),
            }?;
            Ok(ProjectWithStudies { project, studies })
        })
        .await
        .unwrap()
    }

    pub async fn delete(project_id: i64, db_pool: Data<DbPool>) -> Result<()> {
        let db_pool_ref = db_pool.clone();

        let project = block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_project::dsl::*;
            let mut conn = db_pool_ref.get().expect("Failed to get DB connection");
            match delete(osrd_infra_project.filter(id.eq(project_id)))
                .get_result::<Project>(&mut conn)
            {
                Ok(project) => Ok(project),
                Err(DieselError::NotFound) => Err(ProjectError::NotFound { project_id }.into()),
                Err(err) => Err(err.into()),
            }
        })
        .await
        .unwrap()?;
        if let Some(image) = project.image_id {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete(db_pool.clone(), image).await;
        };
        Ok(())
    }

    pub async fn update(
        form: ProjectPatchForm,
        db_pool: Data<DbPool>,
        project_id: i64,
    ) -> Result<ProjectWithStudies> {
        if let Some(image) = form.image_id {
            check_image_content(db_pool.clone(), image).await?;
        }

        let project_studies = Project::retrieve(db_pool.clone(), project_id).await?;
        let project = &project_studies.project;
        let image_to_delete = if project.image_id != form.image_id {
            project.image_id
        } else {
            None
        };

        let project_payload: ProjectPatchPayload = form.into();
        let db_pool_ref = db_pool.clone();
        let project = block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_project::dsl::*;
            let mut conn = db_pool_ref.get().expect("Failed to get DB connection");
            match update(osrd_infra_project.find(project_id))
                .set(&project_payload)
                .get_result::<Project>(&mut conn)
            {
                Ok(project) => Ok(project),
                Err(DieselError::NotFound) => Err(ProjectError::NotFound { project_id }.into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()?;

        if let Some(image) = image_to_delete {
            // We don't check the result. We don't want to throw an error if the image is used in another project.
            let _ = Document::delete(db_pool, image).await;
        }

        Ok(ProjectWithStudies {
            project,
            studies: project_studies.studies,
        })
    }
}

#[cfg(test)]
pub mod test {

    use super::{Project, ProjectCreateForm, ProjectPatchForm};
    use crate::client::PostgresConfig;
    use crate::error::EditoastError;
    use crate::projects::ProjectError;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    #[actix_test]
    async fn create_delete_project() {
        let project_data: ProjectCreateForm = ProjectCreateForm {
            name: "test".into(),
            ..Default::default()
        };
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Create a project
        let project = Project::create(project_data, pool.clone()).await.unwrap();
        let project_id = project.project.id;
        // Delete the project
        Project::delete(project_id, pool.clone()).await.unwrap();
        // Second delete should fail
        assert_eq!(
            Project::delete(project_id, pool.clone())
                .await
                .unwrap_err()
                .get_type(),
            ProjectError::NotFound { project_id }.get_type()
        );
    }

    #[actix_test]
    async fn get_project() {
        let project_data: ProjectCreateForm = ProjectCreateForm {
            name: "test".into(),
            ..Default::default()
        };
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Create a project
        let project = Project::create(project_data, pool.clone()).await.unwrap();
        let project_id = project.project.id;

        // Get a project
        assert!(Project::retrieve(pool.clone(), project_id).await.is_ok());
        assert!(Project::list(pool.clone(), 1, 25).await.is_ok());
    }

    #[actix_test]
    async fn update_project() {
        let project_data: ProjectCreateForm = ProjectCreateForm {
            name: "test".into(),
            ..Default::default()
        };
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Create a project
        let project = Project::create(project_data, pool.clone()).await.unwrap();
        let project_id = project.project.id;
        // Patch a project

        let project_form: ProjectPatchForm = ProjectPatchForm {
            image_id: None,
            name: Some("update_name".into()),
            description: None,
            objectives: Some("".into()),
            funders: None,
            budget: Some(1000),
            tags: None,
        };
        let project_updated = Project::update(project_form, pool.clone(), project_id).await;
        assert_eq!(
            project_updated.unwrap().project.name,
            String::from("update_name")
        )
    }
}
