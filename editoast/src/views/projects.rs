use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use chrono::Utc;
use derivative::Derivative;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::operational_studies::OperationalStudiesOrderingParam;
use super::pagination::PaginatedList;
use super::pagination::PaginationStats;
use super::study;
use super::AuthenticationExt;
use crate::error::Result;
use crate::models::Changeset;
use crate::models::Create;
use crate::models::Document;
use crate::models::Model;
use crate::models::Project;
use crate::models::Retrieve;
use crate::models::Tags;
use crate::views::pagination::PaginationQueryParams;
use crate::views::AuthorizationError;

crate::routes! {
    "/projects" => {
        create,
        list,
        "/{project_id}" => {
            get,
            delete,
            patch,
            &study,
        },
    },
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
    post, path = "",
    tag = "projects",
    request_body = ProjectCreateForm,
    responses(
        (status = 201, body = ProjectWithStudies, description = "The created project"),
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(project_create_form): Json<ProjectCreateForm>,
) -> Result<Json<ProjectWithStudyCount>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
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
    get, path = "",
    tag = "projects",
    params(PaginationQueryParams, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(ProjectWithStudyCountList), description = "The list of projects"),
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Query(pagination_params): Query<PaginationQueryParams>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ProjectWithStudyCountList>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let ordering = ordering_params.ordering;
    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings()
        .order_by(move || ordering.as_project_ordering());

    let conn = &mut db_pool.get().await?;

    let (projects, stats) = Project::list_paginated(conn, settings).await?;

    let results = projects
        .into_iter()
        .zip(db_pool.iter_conn())
        .map(|(project, conn)| async move {
            ProjectWithStudyCount::try_fetch(&mut conn.await?, project).await
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
    get, path = "",
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 200, body = ProjectWithStudies, description = "The requested project"),
        (status = 404, body = InternalError, description = "The requested project was not found"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
) -> Result<Json<ProjectWithStudyCount>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
    Ok(Json(ProjectWithStudyCount::try_fetch(conn, project).await?))
}

/// Delete a project
#[utoipa::path(
    delete, path = "",
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 204, description = "The project was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested project was not found"),
    )
)]
async fn delete(
    Path(project_id): Path<i64>,
    Extension(auth): AuthenticationExt,
    State(db_pool): State<DbConnectionPoolV2>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    if Project::delete_and_prune_document(conn, project_id).await? {
        Ok(axum::http::StatusCode::NO_CONTENT)
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
    #[serde(default, with = "double_option")]
    pub description: Option<Option<String>>,
    #[schema(max_length = 4096)]
    #[serde(default, with = "double_option")]
    pub objectives: Option<Option<String>>,
    #[schema(max_length = 1024)]
    #[serde(default, with = "double_option")]
    pub funders: Option<Option<String>>,
    #[serde(default, with = "double_option")]
    pub budget: Option<Option<i32>>,
    /// The id of the image document
    #[serde(default, with = "double_option")]
    pub image: Option<Option<i64>>,
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
            .flat_budget(project.budget)
            .flat_image(project.image)
            .flat_tags(project.tags)
            .last_modification(Utc::now().naive_utc())
    }
}

/// Update a project
#[utoipa::path(
    patch, path = "",
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
async fn patch(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
    Json(form): Json<ProjectPatchForm>,
) -> Result<Json<ProjectWithStudyCount>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    if let Some(Some(image)) = form.image {
        check_image_content(conn, image).await?;
    }
    let project_changeset: Changeset<Project> = form.into();
    let project = Project::update_and_prune_document(conn, project_changeset, project_id).await?;
    Ok(Json(ProjectWithStudyCount::try_fetch(conn, project).await?))
}

#[cfg(test)]
pub mod tests {

    use std::collections::HashSet;

    use axum::http::StatusCode;
    use editoast_authz::authorizer::UserInfo;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::core::mocking::MockingClient;
    use crate::core::CoreClient;
    use crate::models::fixtures::create_project;
    use crate::models::prelude::*;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::test_app::TestRequestExt;

    #[rstest]
    async fn project_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let project_name = "test_project";

        let request = app.post("/projects").json(&json!({
            "name": project_name,
            "description": "",
            "objectives": "",
            "funders": "",
        }));

        let response: ProjectWithStudyCount =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let project = Project::retrieve(&mut pool.get_ok(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
    }

    #[rstest]
    async fn project_post_should_fail_when_authorization_is_enabled() {
        let pool = DbConnectionPoolV2::for_tests();
        let user = UserInfo {
            identity: "user_identity".to_string(),
            name: "user_name".to_string(),
        };
        let app = TestAppBuilder::new()
            .db_pool(pool)
            .core_client(CoreClient::Mocked(MockingClient::default()))
            .enable_authorization(true)
            .user(user.clone())
            .roles(HashSet::from([BuiltinRole::OpsRead]))
            .build();

        let request = app.post("/projects").by_user(user).json(&json!({
            "name": "test_project_failed",
            "description": "",
            "objectives": "",
            "funders": "",
        }));

        // OpsWrite is required to complete this request successfully.
        app.fetch(request).assert_status(StatusCode::FORBIDDEN);
    }

    #[rstest]
    async fn project_list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app.get("/projects/");

        let response: ProjectWithStudyCountList =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

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

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app.get(format!("/projects/{}", created_project.id).as_str());

        let response: ProjectWithStudyCount =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.project, created_project);
    }

    #[rstest]
    async fn project_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app.delete(format!("/projects/{}", created_project.id).as_str());

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Project::exists(&mut db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to check if project exists");

        assert!(!exists);
    }

    #[rstest]
    async fn project_patch() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let updated_name = "rename_test";
        let updated_budget = 20000;

        let request = app
            .patch(format!("/projects/{}", created_project.id).as_str())
            .json(&json!({
                "name": updated_name,
                "budget": updated_budget
            }));

        let response: ProjectWithStudyCount =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.project, response.project);

        let project = Project::retrieve(&mut db_pool.get_ok(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, updated_name);
        assert_eq!(project.budget, Some(updated_budget));
        assert!(project.last_modification > created_project.last_modification);
    }
}
