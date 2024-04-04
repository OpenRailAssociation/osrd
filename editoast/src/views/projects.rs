use actix_web::delete;
use actix_web::get;
use actix_web::patch;
use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::HttpResponse;
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::study;
use crate::decl_paginated_response;
use crate::error::Result;
use crate::models::List;
use crate::modelsv2::projects::Tags;
use crate::modelsv2::Changeset;
use crate::modelsv2::Create;
use crate::modelsv2::Document;
use crate::modelsv2::Model;
use crate::modelsv2::Ordering;
use crate::modelsv2::Project;
use crate::modelsv2::Retrieve;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::DbPool;

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

editoast_common::schemas! {
    PaginatedResponseOfProjectWithStudies,
    ProjectCreateForm,
    ProjectPatchForm,
    study::schemas(),
    ProjectWithStudies,
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
    #[error("The provided image is not valid : {error}")]
    ImageError { error: String },
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
    pub budget: Option<i32>,
    /// The id of the image document
    pub image: Option<i64>,
    #[serde(default)]
    #[schema(max_length = 255)]
    pub tags: Tags,
}

impl From<ProjectCreateForm> for Changeset<Project> {
    fn from(project: ProjectCreateForm) -> Self {
        Project::changeset()
            .name(project.name)
            .description(project.description)
            .objectives(project.objectives)
            .funders(project.funders)
            .budget(project.budget)
            .image(project.image)
            .tags(project.tags)
            .creation_date(Utc::now().naive_utc())
            .last_modification(Utc::now().naive_utc())
    }
}

async fn check_image_content(db_pool: Data<DbPool>, document_key: i64) -> Result<()> {
    let conn = &mut db_pool.get().await?;
    let doc = Document::retrieve_or_fail(conn, document_key, || ProjectError::ImageNotFound {
        document_key,
    })
    .await?;

    if let Err(e) = image::load_from_memory(&doc.data) {
        return Err(ProjectError::ImageError {
            error: e.to_string(),
        }
        .into());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ProjectWithStudies {
    #[serde(flatten)]
    project: Project,
    studies_count: i64,
}

impl ProjectWithStudies {
    pub fn new_from_project(project: Project, studies_count: i64) -> Self {
        Self {
            project,
            studies_count,
        }
    }
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
    let project_create_form = data.into_inner();
    if let Some(image) = project_create_form.image {
        check_image_content(db_pool.clone(), image).await?;
    }
    let project: Changeset<Project> = project_create_form.into();
    let conn = &mut db_pool.get().await?;
    let project = project.create(conn).await?;
    let project_with_studies = ProjectWithStudies::new_from_project(project, 0);

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
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let ordering = params.ordering.clone();
    let projects = Project::list(db_pool.clone(), page, per_page, ordering).await?;
    let mut results = Vec::new();
    for project in projects.results.into_iter() {
        let studies_count = project.studies_count(db_pool.clone()).await?;
        results.push(ProjectWithStudies::new_from_project(project, studies_count));
    }

    Ok(Json(PaginatedResponse {
        count: projects.count,
        previous: projects.previous,
        next: projects.next,
        results,
    }))
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
    let conn = &mut db_pool.get().await?;
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
    let studies_count = project.studies_count(db_pool).await?;
    Ok(Json(ProjectWithStudies::new_from_project(
        project,
        studies_count,
    )))
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
    let conn = &mut db_pool.get().await?;
    if Project::delete_and_prune_document(conn, project_id).await? {
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
    pub tags: Option<Tags>,
}

impl From<ProjectPatchForm> for Changeset<Project> {
    fn from(project: ProjectPatchForm) -> Self {
        Project::changeset()
            .flat_name(project.name)
            .flat_description(project.description)
            .flat_objectives(project.objectives)
            .flat_funders(project.funders)
            .flat_budget(Some(project.budget))
            .flat_image(Some(project.image))
            .flat_tags(project.tags)
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
    project_id: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<ProjectWithStudies>> {
    let data = data.into_inner();
    let project_id = project_id.into_inner();
    if let Some(image) = data.image {
        check_image_content(db_pool.clone(), image).await?;
    }
    let project_changeset: Changeset<Project> = data.into();
    let conn = &mut db_pool.get().await?;
    let project = Project::update_and_prune_document(conn, project_changeset, project_id).await?;
    let studies_count = project.studies_count(db_pool).await?;
    Ok(Json(ProjectWithStudies::new_from_project(
        project,
        studies_count,
    )))
}

#[cfg(test)]
pub mod test {
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::project;
    use crate::fixtures::tests::TestFixture;
    use crate::modelsv2::DeleteStatic;
    use crate::views::tests::create_test_service;

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
        let conn = &mut db_pool.get().await.unwrap();
        Project::delete_static(conn, project.id).await.unwrap();
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
