use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::Utc;
use database::DbConnection;
use database::DbConnectionPoolV2;
use diesel_async::scoped_futures::ScopedFutureExt as _;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AuthenticationExt;
use super::operational_studies::OperationalStudiesOrderingParam;
use super::pagination::PaginatedList;
use super::pagination::PaginationStats;
use crate::error::Result;
use crate::models::Project;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginationQueryParams;
use editoast_models::Document;
use editoast_models::tags::Tags;

#[derive(Debug, Error, EditoastError, derive_more::From)]
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
    #[error("The provided image is not valid: {error}")]
    ImageError { error: String },
    #[error(transparent)]
    #[from(forward)]
    #[editoast_error(status = 500)]
    Database(editoast_models::Error),
}

/// Creation form for a project
#[derive(Serialize, Deserialize, Default, ToSchema)]
pub(in crate::views) struct ProjectCreateForm {
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
            .creation_date(Utc::now())
            .last_modification(Utc::now())
    }
}

async fn check_image_content(conn: &mut DbConnection, document_key: i64) -> Result<()> {
    let doc = Document::retrieve_or_fail(conn.clone(), document_key, || {
        ProjectError::ImageNotFound { document_key }
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
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "projects",
    request_body = ProjectCreateForm,
    responses(
        (status = 201, body = ProjectWithStudyCount, description = "The created project"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(project_create_form): Json<ProjectCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
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
    let project = project.create(conn).await.map_err(ProjectError::from)?;
    let project_with_studies = ProjectWithStudyCount::try_fetch(conn, project).await?;

    Ok((StatusCode::CREATED, Json(project_with_studies)))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct ProjectWithStudyCountList {
    results: Vec<ProjectWithStudyCount>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Returns a paginated list of projects
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "projects",
    params(PaginationQueryParams<1000>, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(ProjectWithStudyCountList), description = "The list of projects"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(pagination_params): Query<PaginationQueryParams<1000>>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ProjectWithStudyCountList>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let ordering = ordering_params.ordering;
    let settings = pagination_params
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
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 200, body = ProjectWithStudyCount, description = "The requested project"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
) -> Result<Json<ProjectWithStudyCount>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let mut conn = db_pool.get().await?;
    let project = Project::retrieve_or_fail(conn.clone(), project_id, || ProjectError::NotFound {
        project_id,
    })
    .await?;
    Ok(Json(
        ProjectWithStudyCount::try_fetch(&mut conn, project).await?,
    ))
}

/// Delete a project
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 204, description = "The project was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    Path(project_id): Path<i64>,
    Extension(auth): AuthenticationExt,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    db_pool
        .get()
        .await?
        .transaction(|mut conn| {
            async move {
                let project = Project::retrieve_or_fail(conn.clone(), project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;
                project.delete_and_prune_document(&mut conn).await?;
                Ok::<_, ProjectError>(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Patch form for a project
#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct ProjectPatchForm {
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
            .last_modification(Utc::now())
    }
}

/// Update a project
#[editoast_derive::route]
#[utoipa::path(
    patch, path = "",
    tag = "projects",
    params(ProjectIdParam),
    request_body(
        content = ProjectPatchForm,
        description = "The fields to update"
    ),
    responses(
        (status = 200, body = ProjectWithStudyCount, description = "The updated project"),
    )
)]
pub(in crate::views) async fn patch(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
    Json(mut form): Json<ProjectPatchForm>,
) -> Result<Json<ProjectWithStudyCount>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;
    let update_image = match form.image {
        // image replacement
        Some(Some(new_image)) => {
            check_image_content(&mut conn, new_image).await?;
            form.image = None;
            Some(Some(new_image))
        }
        // image removal
        Some(None) => {
            form.image = None;
            Some(None)
        }
        // no image change requested, there may or may not be an image
        None => None,
    };
    let project_changeset: Changeset<Project> = form.into();

    let project =
        Project::transactional_content_update(conn.clone(), project_id, |mut conn, project| {
            async move {
                let mut project = project_changeset
                    .update_or_fail(&mut conn, project.id, || ProjectError::NotFound {
                        project_id: project.id,
                    })
                    .await?;
                if let Some(new_doc_id) = update_image {
                    project
                        .update_and_prune_document(&mut conn, new_doc_id)
                        .await?;
                }
                Ok::<_, ProjectError>(project)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(
        ProjectWithStudyCount::try_fetch(&mut conn, project).await?,
    ))
}

#[cfg(test)]
pub mod tests {
    use super::*;

    use pretty_assertions::assert_eq;

    use serde_json::json;

    use crate::models::fixtures::create_project;
    use crate::views::test_app;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::test_app::TestRequestExt;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        let response: ProjectWithStudyCount = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let project = Project::retrieve(pool.get_ok(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_post_should_fail_when_authorization_is_enabled() {
        let app = test_app!().enable_authorization(true).build();
        let user = app
            .user("bob", "Bob")
            .with_roles([Role::Stdcm])
            .create()
            .await;

        let request = app.post("/projects").by_user(&user).json(&json!({
            "name": "test_project_failed",
            "description": "",
            "objectives": "",
            "funders": "",
        }));

        // OpsWrite is required to complete this request successfully.
        app.fetch(request)
            .await
            .assert_status(StatusCode::FORBIDDEN);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app.get("/projects/");

        let response: ProjectWithStudyCountList = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let project_retrieved = response
            .results
            .iter()
            .find(|p| p.project.id == created_project.id)
            .unwrap();

        assert_eq!(created_project, project_retrieved.project);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app.get(format!("/projects/{}", created_project.id).as_str());

        let response: ProjectWithStudyCount = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.project, created_project);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app.delete(format!("/projects/{}", created_project.id).as_str());

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = Project::exists(&mut db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to check if project exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        let response: ProjectWithStudyCount = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let project = Project::retrieve(db_pool.get_ok(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, updated_name);
        assert_eq!(project.budget, Some(updated_budget));
        assert!(project.last_modification > created_project.last_modification);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_update_image() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        // no image by default
        let project = create_project(&mut db_pool.get_ok(), &app.name("project")).await;

        let check_image = |conn: DbConnection, image_id: Option<i64>| async move {
            let p = Project::retrieve(conn, project.id)
                .await
                .expect("Failed to retrieve project")
                .expect("Project not found");
            assert_eq!(p.image, image_id);
        };

        let data = [
            // PNG Signature (8 bytes)
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // IHDR Chunk (Image Header)
            0x00, 0x00, 0x00, 0x0D, // Chunk Length
            0x49, 0x48, 0x44, 0x52, // "IHDR"
            0x00, 0x00, 0x00, 0x02, // Width: 2 pixels
            0x00, 0x00, 0x00, 0x02, // Height: 2 pixels
            0x08, // Bit depth: 8
            0x02, // Color type: Truecolor (RGB)
            0x00, // Compression method: 0 (deflate)
            0x00, // Filter method: 0
            0x00, // Interlace method: 0 (no interlace)
            0xFD, 0xD4, 0x9A, 0x73, // CRC
            // IDAT Chunk (Image Data)
            0x00, 0x00, 0x00, 0x13, // Chunk Length
            0x49, 0x44, 0x41, 0x54, // "IDAT"
            0x78, 0x01, // zlib compression header
            0x63, 0x64, 0x60, 0xF8, 0xCF, 0xC0, 0xC0, 0xC0, 0x04, 0xC4, 0x40, 0x00, 0x00, 0x0B,
            0x1F, 0x01, // Compressed image data
            0x03, 0xD5, 0xA9, 0x3F, 0xA9, // CRC
            // IEND Chunk (Image End)
            0x00, 0x00, 0x00, 0x00, // Chunk Length
            0x49, 0x45, 0x4E, 0x44, // "IEND"
            0xAE, 0x42, 0x60, 0x82, // CRC
        ];

        let image = Document::changeset()
            .content_type("image/png".to_owned())
            .data(data.to_vec())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create image");

        // let's add one
        let request = app
            .patch(format!("/projects/{}", project.id).as_str())
            .json(&json!({
                "image": image.id
            }));
        app.fetch(request).await.assert_status(StatusCode::OK);

        check_image(db_pool.get_ok(), Some(image.id)).await;

        // now we update it
        let old_image = image;
        let new_image = Document::changeset()
            .content_type("image/png".to_owned())
            .data(data.to_vec())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create new image");

        let request = app
            .patch(format!("/projects/{}", project.id).as_str())
            .json(&json!({
                "image": new_image.id
            }));
        app.fetch(request).await.assert_status(StatusCode::OK);

        check_image(db_pool.get_ok(), Some(new_image.id)).await;
        assert!(
            !Document::exists(&mut db_pool.get_ok(), old_image.id)
                .await
                .unwrap()
        );

        // now we remove the image
        let request = app
            .patch(format!("/projects/{}", project.id).as_str())
            .json(&json!({
                "image": null
            }));
        app.fetch(request).await.assert_status(StatusCode::OK);

        check_image(db_pool.get_ok(), None).await;
        assert!(
            !Document::exists(&mut db_pool.get_ok(), new_image.id)
                .await
                .unwrap()
        );
    }
}
