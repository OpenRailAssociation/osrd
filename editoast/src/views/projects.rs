use std::ops::DerefMut;

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

use super::operational_studies::OperationalStudiesOrderingParam;
use super::pagination::PaginatedList;
use super::pagination::PaginationStats;
use super::study;
use crate::error::Result;
use crate::modelsv2::projects::Tags;
use crate::modelsv2::Changeset;
use crate::modelsv2::Create;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPoolV2;
use crate::modelsv2::Document;
use crate::modelsv2::Model;
use crate::modelsv2::Project;
use crate::modelsv2::Retrieve;
use crate::views::pagination::PaginationQueryParam;

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
    ProjectCreateForm,
    ProjectPatchForm,
    study::schemas(),
    ProjectWithStudyCount,
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

/// Creation form for a project
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ProjectCreateForm {
    #[schema(max_length = 128)]
    pub name: String,
    #[schema(max_length = 1024)]
    pub description: Option<String>,
    #[schema(max_length = 4096)]
    pub objectives: Option<String>,
    #[schema(max_length = 1024)]
    pub funders: Option<String>,
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

async fn check_image_content(conn: &mut DbConnection, document_key: i64) -> Result<()> {
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
#[schema(as = ProjectWithStudies)]
#[cfg_attr(test, derive(Deserialize))]
pub struct ProjectWithStudyCount {
    #[serde(flatten)]
    project: Project,
    studies_count: u64,
}

impl ProjectWithStudyCount {
    async fn try_fetch(conn: &mut DbConnection, project: Project) -> Result<Self> {
        let studies_count = project.studies_count(conn).await?;
        Ok(Self {
            project,
            studies_count,
        })
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
    db_pool: Data<DbConnectionPoolV2>,
    data: Json<ProjectCreateForm>,
) -> Result<Json<ProjectWithStudyCount>> {
    let conn = &mut db_pool.get().await?;
    let project_create_form = data.into_inner();
    if let Some(image) = project_create_form.image {
        check_image_content(conn, image).await?;
    }
    let project: Changeset<Project> = project_create_form.into();
    let project = project.create(conn).await?;
    let project_with_studies = ProjectWithStudyCount::try_fetch(conn, project).await?;

    Ok(Json(project_with_studies))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct ProjectWithStudyCountList {
    #[schema(value_type = Vec<ProjectWithStudies>)]
    results: Vec<ProjectWithStudyCount>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Returns a paginated list of projects
#[utoipa::path(
    tag = "projects",
    params(PaginationQueryParam, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(ProjectWithStudyCountList), description = "The list of projects"),
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbConnectionPoolV2>,
    pagination_params: Query<PaginationQueryParam>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ProjectWithStudyCountList>> {
    let ordering = ordering_params.ordering;
    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings()
        .order_by(move || ordering.as_project_ordering());

    let (projects, stats) =
        Project::list_paginated(db_pool.get().await?.deref_mut(), settings).await?;

    let results = projects
        .into_iter()
        .zip(db_pool.iter_conn())
        .map(|(project, conn)| async move {
            ProjectWithStudyCount::try_fetch(conn.await?.deref_mut(), project).await
        });
    let results = futures::future::try_join_all(results).await?;
    Ok(Json(ProjectWithStudyCountList { results, stats }))
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
async fn get(
    db_pool: Data<DbConnectionPoolV2>,
    project: Path<i64>,
) -> Result<Json<ProjectWithStudyCount>> {
    let project_id = project.into_inner();
    let conn = &mut db_pool.get().await?;
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
    Ok(Json(ProjectWithStudyCount::try_fetch(conn, project).await?))
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
async fn delete(project: Path<i64>, db_pool: Data<DbConnectionPoolV2>) -> Result<HttpResponse> {
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
            .description(project.description)
            .objectives(project.objectives)
            .funders(project.funders)
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
    db_pool: Data<DbConnectionPoolV2>,
) -> Result<Json<ProjectWithStudyCount>> {
    let conn = &mut db_pool.get().await?;
    let data = data.into_inner();
    let project_id = project_id.into_inner();
    if let Some(image) = data.image {
        check_image_content(conn, image).await?;
    }
    let project_changeset: Changeset<Project> = data.into();
    let project = Project::update_and_prune_document(conn, project_changeset, project_id).await?;
    Ok(Json(ProjectWithStudyCount::try_fetch(conn, project).await?))
}

#[cfg(test)]
pub mod test {
    use std::ops::DerefMut;

    use actix_web::http::StatusCode;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::modelsv2::fixtures::create_project;
    use crate::modelsv2::prelude::*;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn project_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let project_name = "test_project";

        let request = TestRequest::post()
            .uri("/projects")
            .set_json(json!({
                "name": project_name,
                "description": "",
                "objectives": "",
                "funders": "",
            }))
            .to_request();

        let response: ProjectWithStudyCount = call_and_read_body_json(&app.service, request).await;

        let project = Project::retrieve(pool.get_ok().deref_mut(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
    }

    #[rstest]
    async fn project_list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let request = TestRequest::get().uri("/projects/").to_request();
        let response: ProjectWithStudyCountList =
            call_and_read_body_json(&app.service, request).await;

        let project_retreived = response
            .results
            .iter()
            .find(|p| p.project.id == created_project.id)
            .unwrap();

        assert_eq!(created_project, project_retreived.project);
    }

    #[rstest]
    async fn project_get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let request = TestRequest::get()
            .uri(format!("/projects/{}", created_project.id).as_str())
            .to_request();
        let response: ProjectWithStudyCount = call_and_read_body_json(&app.service, request).await;

        assert_eq!(response.project, created_project);
    }

    #[rstest]
    async fn project_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let request = TestRequest::delete()
            .uri(format!("/projects/{}", created_project.id).as_str())
            .to_request();

        let response = call_service(&app.service, request).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let exists = Project::exists(db_pool.get_ok().deref_mut(), created_project.id)
            .await
            .expect("Failed to check if project exists");

        assert!(!exists);
    }

    #[rstest]
    async fn project_patch() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let updated_name = "rename_test";
        let updated_budget = 20000;

        let request = TestRequest::patch()
            .uri(format!("/projects/{}", created_project.id).as_str())
            .set_json(json!({
                "name": updated_name,
                "budget": updated_budget
            }))
            .to_request();

        let response: ProjectWithStudyCount = call_and_read_body_json(&app.service, request).await;

        assert_eq!(response.project, response.project);

        let project = Project::retrieve(db_pool.get_ok().deref_mut(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, updated_name);
        assert_eq!(project.budget, Some(updated_budget));
    }
}
