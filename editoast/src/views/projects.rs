use crate::decl_paginated_response;
use crate::error::Result;
use crate::models::Create;
use crate::models::Delete;
use crate::models::Document;
use crate::models::List;
use crate::models::Ordering;
use crate::models::Project;
use crate::models::ProjectWithStudies;
use crate::models::Retrieve;
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::DbPool;

use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use image::ImageError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::study;

crate::routes! {
    "/projects" => {
        create,
        list,
        "/{project_id}" => {
            get,
            delete,
            patch,
            study::routes()
        },
    }
}

crate::schemas! {
    PaginatedResponseOfProjectWithStudies,
    ProjectCreateForm,
    ProjectPatchForm,
    study::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "project")]
pub enum ProjectError {
    /// Couldn't found the project with the given id
    #[error("Project '{project_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { project_id: i64 },
    // Couldn't found the project with the given id
    #[error("Image document '{document_key}' not found")]
    ImageNotFound { document_key: i64 },
    // Couldn't found the project with the given id
    #[error("The provided image is not valid : {0}")]
    ImageError(ImageError),
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
pub struct QueryParams {
    #[serde(default = "Ordering::default")]
    pub ordering: Ordering,
}

/// Creation form for a project
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ProjectCreateForm {
    #[schema(max_length = 128)]
    pub name: String,
    #[serde(default)]
    #[schema(max_length = 1024)]
    pub description: String,
    #[serde(default)]
    #[schema(max_length = 4096)]
    pub objectives: String,
    #[serde(default)]
    #[schema(max_length = 1024)]
    pub funders: String,
    #[serde(default)]
    pub budget: i32,
    /// The id of the image document
    pub image: Option<i64>,
    #[serde(default)]
    #[schema(max_length = 255)]
    pub tags: Vec<String>,
}

impl From<ProjectCreateForm> for Project {
    fn from(project: ProjectCreateForm) -> Self {
        Project {
            name: Some(project.name),
            description: Some(project.description),
            objectives: Some(project.objectives),
            funders: Some(project.funders),
            budget: Some(project.budget),
            image: project.image.map(Some),
            tags: Some(project.tags),
            creation_date: Some(Utc::now().naive_utc()),
            ..Default::default()
        }
    }
}

async fn check_image_content(db_pool: Data<DbPool>, document_key: i64) -> Result<()> {
    let doc = match Document::retrieve(db_pool, document_key).await? {
        Some(doc) => doc,
        None => return Err(ProjectError::ImageNotFound { document_key }.into()),
    };

    if let Err(e) = image::load_from_memory(&doc.data.unwrap()) {
        return Err(ProjectError::ImageError(e).into());
    }
    Ok(())
}

/// Create a new project
#[utoipa::path(
    tag = "projects",
    request_body = ProjectCreateForm,
    responses(
        (status = 201, body = ProjectWithStudies, description = "The created project"),
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<ProjectCreateForm>,
) -> Result<Json<ProjectWithStudies>> {
    let project: Project = data.into_inner().into();
    if let Some(Some(image)) = project.image {
        check_image_content(db_pool.clone(), image).await?;
    }
    let project = project.create(db_pool).await?;
    let project_with_studies = ProjectWithStudies {
        project,
        studies_count: 0,
    };

    Ok(Json(project_with_studies))
}

decl_paginated_response!(PaginatedResponseOfProjectWithStudies, ProjectWithStudies);

/// Returns a paginated list of projects
#[utoipa::path(
    tag = "projects",
    params(PaginationQueryParam, QueryParams),
    responses(
        (status = 200, body = PaginatedResponseOfProjectWithStudies, description = "The list of projects"),
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
    params: Query<QueryParams>,
) -> Result<Json<PaginatedResponse<ProjectWithStudies>>> {
    pagination_params.validate(100)?;
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let ordering = params.ordering.clone();
    let projects = ProjectWithStudies::list(db_pool, page, per_page, ordering).await?;

    Ok(Json(projects))
}

// Documentation struct
#[derive(IntoParams)]
#[allow(unused)]
pub struct ProjectIdParam {
    /// The id of a project
    project_id: i64,
}

/// Retrieve a project
#[utoipa::path(
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 200, body = ProjectWithStudies, description = "The requested project"),
        (status = 404, body = InternalError, description = "The requested project was not found"),
    )
)]
#[get("")]
async fn get(db_pool: Data<DbPool>, project: Path<i64>) -> Result<Json<ProjectWithStudies>> {
    let project_id = project.into_inner();
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        Some(project) => project,
        None => return Err(ProjectError::NotFound { project_id }.into()),
    };
    let project_studies = project.with_studies(db_pool).await?;
    Ok(Json(project_studies))
}

/// Delete a project
#[utoipa::path(
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 204, description = "The project was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested project was not found"),
    )
)]
#[delete("")]
async fn delete(project: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let project_id = project.into_inner();
    if Project::delete(db_pool, project_id).await? {
        Ok(HttpResponse::NoContent().finish())
    } else {
        Err(ProjectError::NotFound { project_id }.into())
    }
}

/// Patch form for a project
#[derive(Serialize, Deserialize, ToSchema)]
struct ProjectPatchForm {
    #[schema(max_length = 128)]
    pub name: Option<String>,
    #[schema(max_length = 1024)]
    pub description: Option<String>,
    #[schema(max_length = 4096)]
    pub objectives: Option<String>,
    #[schema(max_length = 1024)]
    pub funders: Option<String>,
    pub budget: Option<i32>,
    /// The id of the image document
    pub image: Option<i64>,
    #[schema(max_length = 255)]
    pub tags: Option<Vec<String>>,
}

impl ProjectPatchForm {
    fn into_project(self, project_id: i64) -> Project {
        Project {
            id: Some(project_id),
            name: self.name,
            description: self.description,
            objectives: self.objectives,
            funders: self.funders,
            budget: self.budget,
            image: Some(self.image),
            tags: self.tags,
            ..Default::default()
        }
    }
}

/// Update a project
#[utoipa::path(
    tag = "projects",
    params(ProjectIdParam),
    request_body(
        content = ProjectPatchForm,
        description = "The fields to update"
    ),
    responses(
        (status = 200, body = ProjectWithStudies, description = "The updated project"),
        (status = 404, body = InternalError, description = "The requested project was not found"),
    )
)]
#[patch("")]
async fn patch(
    data: Json<ProjectPatchForm>,
    project: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<ProjectWithStudies>> {
    let data = data.into_inner();
    let project_id = project.into_inner();
    let project = data.into_project(project_id);
    if let Some(Some(image)) = project.image {
        check_image_content(db_pool.clone(), image).await?;
    }
    let project = match project.update(db_pool.clone()).await? {
        Some(project) => project,
        None => return Err(ProjectError::NotFound { project_id }.into()),
    };
    let project_studies = project.with_studies(db_pool).await?;
    Ok(Json(project_studies))
}

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{db_pool, project, TestFixture};
    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    fn delete_project_request(project_id: i64) -> Request {
        TestRequest::delete()
            .uri(format!("/projects/{project_id}").as_str())
            .to_request()
    }

    #[rstest]
    async fn project_create_delete(db_pool: Data<DbPool>) {
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/projects")
            .set_json(json!({ "name": "test_project","description": "", "objectives":"" }))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let project: Project = read_body_json(response).await;
        Project::delete(db_pool, project.id.unwrap()).await.unwrap();
    }

    #[rstest]
    async fn project_delete(#[future] project: TestFixture<Project>) {
        let app = create_test_service().await;
        let project = project.await;
        let response = call_service(&app, delete_project_request(project.id())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let response = call_service(&app, delete_project_request(project.id())).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn project_list() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/projects/").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn project_get(#[future] project: TestFixture<Project>) {
        let app = create_test_service().await;
        let project = project.await;

        let req = TestRequest::get()
            .uri(format!("/projects/{}", project.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn project_patch(#[future] project: TestFixture<Project>) {
        let app = create_test_service().await;
        let project = project.await;
        let req = TestRequest::patch()
            .uri(format!("/projects/{}", project.id()).as_str())
            .set_json(json!({"name": "rename_test", "budget":20000}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
