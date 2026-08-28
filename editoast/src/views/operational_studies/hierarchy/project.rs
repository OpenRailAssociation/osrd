use authz::ProjectPrivilege;
use authz::Role;
use authz::v2::project_privilege_check;
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
use editoast_derive::EditoastError;
use models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::OperationalStudiesOrderingParam;
use crate::AppState;
use crate::authentication;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::operational_studies::hierarchy::enable_project_perm;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use models::Document;
use models::project::Project;
use models::tags::Tags;

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
    #[from(models::Error, database::DatabaseError)]
    #[editoast_error(status = 500)]
    Database(models::Error),
}

impl From<models::project::Error> for ProjectError {
    fn from(e: models::project::Error) -> Self {
        match e {
            models::project::Error::NotFound { project_id } => {
                ProjectError::NotFound { project_id }
            }
            models::project::Error::Database(e) => ProjectError::Database(e),
        }
    }
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

impl ProjectCreateForm {
    fn into_changeset(self) -> Changeset<Project> {
        Project::changeset()
            .name(self.name)
            .description(self.description)
            .objectives(self.objectives)
            .funders(self.funders)
            .budget(self.budget)
            .image(self.image)
            .tags(self.tags)
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
    async fn try_fetch(conn: DbConnection, project: Project) -> Result<Self, models::Error> {
        let studies_count = project.studies_count(conn).await?;
        Ok(Self {
            project,
            studies_count,
        })
    }
}

/// Create a new project
#[editoast_derive::route(Role::OperationalStudies)]
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
    Json(project_create_form): Json<ProjectCreateForm>,
) -> Result<impl IntoResponse> {
    let mut conn = db_pool.get().await?;
    if let Some(image) = project_create_form.image {
        check_image_content(&mut conn, image).await?;
    }
    let project: Changeset<Project> = project_create_form.into_changeset();
    let project = project
        .create(&mut conn)
        .await
        .map_err(ProjectError::from)?;
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
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "projects",
    params(PaginationQueryParams<1000>, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(ProjectWithStudyCountList), description = "The list of projects"),
    )
)]
pub(in crate::views) async fn list(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Query(pagination_params): Query<PaginationQueryParams<1000>>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ProjectWithStudyCountList>> {
    let ordering = ordering_params.ordering;
    let default_settings = pagination_params
        .into_selection_settings()
        .order_by(move || ordering.as_project_ordering());
    let settings = match &authn_state {
        crate::authentication::State::Skip => default_settings,
        crate::authentication::State::Authenticated { user, .. } => {
            let authorized_projects = authz::v2::project_list(*user)
                .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
                .await?;
            match authorized_projects {
                authz::v2::ResourcesList::All => default_settings,
                authz::v2::ResourcesList::Privileged(authorized_projects) => default_settings
                    .filter(move || {
                        Project::ID.eq_any(
                            authorized_projects
                                .iter()
                                .map(|project| project.0)
                                .collect(),
                        )
                    }),
            }
        }
    };

    let (projects, stats) = {
        let conn = &mut db_pool.get().await?;
        Project::list_paginated(conn, settings).await?
    };

    let results = projects
        .into_iter()
        .zip(db_pool.iter_conn())
        .map(|(project, conn)| async move {
            ProjectWithStudyCount::try_fetch(conn.await?, project)
                .await
                .map_err(InternalError::from)
        });
    let results = futures::future::try_join_all(results).await?;
    Ok(Json(ProjectWithStudyCountList { results, stats }))
}

// Documentation struct
#[derive(IntoParams)]
#[allow(unused)]
pub(in crate::views) struct ProjectIdParam {
    /// The id of a project
    project_id: i64,
}

/// Retrieve a project
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "projects",
    params(ProjectIdParam),
    responses(
        (status = 200, body = ProjectWithStudyCount, description = "The requested project"),
    )
)]
pub(in crate::views) async fn get(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Path(project_id): Path<i64>,
) -> Result<Json<ProjectWithStudyCount>> {
    let conn = db_pool.get().await?;
    let project = Project::retrieve_or_fail(conn.clone(), project_id, || ProjectError::NotFound {
        project_id,
    })
    .await?;

    if enable_project_perm() {
        project_privilege_check(authz::Project(project_id), ProjectPrivilege::HasAccess)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await?;
    }

    Ok(Json(ProjectWithStudyCount::try_fetch(conn, project).await?))
}

/// Delete a project
#[editoast_derive::route(Role::OperationalStudies)]
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<impl IntoResponse> {
    db_pool
        .get()
        .await?
        .transaction(async move |mut conn| {
            let project = Project::retrieve_or_fail(conn.clone(), project_id, || {
                ProjectError::NotFound { project_id }
            })
            .await?;
            project.delete_and_prune_document(&mut conn).await?;
            Ok::<_, ProjectError>(())
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

impl ProjectPatchForm {
    fn into_changeset(self) -> Changeset<Project> {
        Project::changeset()
            .flat_name(self.name)
            .flat_description(self.description)
            .flat_objectives(self.objectives)
            .flat_funders(self.funders)
            .flat_budget(self.budget)
            .flat_image(self.image)
            .flat_tags(self.tags)
            .last_modification(Utc::now())
    }
}

/// Update a project
#[editoast_derive::route(Role::OperationalStudies)]
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
    Path(project_id): Path<i64>,
    Json(mut form): Json<ProjectPatchForm>,
) -> Result<Json<ProjectWithStudyCount>> {
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
    let project_changeset = form.into_changeset();

    let project = Project::transactional_content_update(
        conn.clone(),
        project_id,
        async move |mut conn, project| {
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
        },
    )
    .await
    .map_err(ProjectError::from)??;

    Ok(Json(ProjectWithStudyCount::try_fetch(conn, project).await?))
}

#[cfg(test)]
pub mod tests {
    use super::*;

    use authz::ProjectGrant;
    use pretty_assertions::assert_eq;

    use rstest::rstest;
    use serde_json::json;

    use crate::fixtures::create_project;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt as _;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_post() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let project_name = "test_project";

        let response: ProjectWithStudyCount = app
            .post("/projects")
            .json(&json!({
                "name": project_name,
                "description": "",
                "objectives": "",
                "funders": "",
            }))
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        let project = Project::retrieve(pool.get_ok(), response.project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(project.name, project_name);
    }

    #[rstest]
    #[case::owner(
        test_app!().build(),
        app.db_pool().get_ok(),
        futures::future::join_all((0..3).map(|i| (i, _conn.clone())).map(
            async move |(i, mut conn)| create_project(&mut conn, &format!("project{i}")).await,
        ))
        .await,
        app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .with_project_grant(expected_projects[0].id, ProjectGrant::Owner)
            .with_project_grant(expected_projects[1].id, ProjectGrant::Owner)
            .create()
            .await,
        2
    )]
    #[case::no_grant(
        test_app!().build(),
        app.db_pool().get_ok(),
        futures::future::join_all((0..3).map(|i| (i, _conn.clone())).map(
            async move |(i, mut conn)| create_project(&mut conn, &format!("project{i}")).await
        ))
        .await,
        app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await,
        0
    )]
    #[case::admin(
        test_app!().build(),
        app.db_pool().get_ok(),
        futures::future::join_all((0..3).map(|i| (i, _conn.clone())).map(
            async move |(i, mut conn)| create_project(&mut conn, &format!("project{i}")).await,
        ))
        .await,
        app
            .user("user", "User")
            .with_roles([Role::Admin])
            .create()
            .await,
        3
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_list(
        #[case] app: TestApp,
        #[case] _conn: DbConnection,
        #[case] expected_projects: Vec<Project>,
        #[case] user: authz::identity::User,
        #[case] expected_length: usize,
    ) {
        let response: ProjectWithStudyCountList = app
            .get("/projects/")
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        let retrieved_projects = response.results;
        assert_eq!(retrieved_projects.len(), expected_length);

        retrieved_projects
            .iter()
            .for_each(|ProjectWithStudyCount { project, .. }| {
                let expected_project = expected_projects
                    .iter()
                    .find(|p| p.id == project.id)
                    .unwrap();

                assert_eq!(project, expected_project);
            });
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_list_forbidden() {
        let app = test_app!().build();
        let project_id = create_project(&mut app.db_pool().get_ok(), "project")
            .await
            .id;
        let user = app
            .user("user", "User")
            .with_project_grant(project_id, ProjectGrant::Owner)
            .create()
            .await;

        app.get("/projects/")
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[rstest]
    #[case::owner(
        test_app!().build(),
        create_project(&mut app.db_pool().get_ok(), "project").await,
        app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .with_project_grant(project.id, ProjectGrant::Owner)
            .create()
            .await
    )]
    #[case::admin(
        test_app!().build(),
        create_project(&mut app.db_pool().get_ok(), "project").await,
        app
            .user("user", "User")
            .with_roles([Role::Admin])
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_get(
        #[case] app: TestApp,
        #[case] project: Project,
        #[case] user: authz::identity::User,
    ) {
        let response: ProjectWithStudyCount = app
            .get(&format!("/projects/{}", project.id))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.project, project);
    }

    #[rstest]
    #[case::no_role(
        test_app!().build(),
        create_project(&mut app.db_pool().get_ok(), "project").await.id,
        app
            .user("user", "User")
            .with_project_grant(project_id, ProjectGrant::Owner)
            .create()
            .await
    )]
    #[case::no_grant(
        test_app!().build(),
        create_project(&mut app.db_pool().get_ok(), "project").await.id,
        app
            .user("user2", "User2")
            .with_roles([Role::OperationalStudies])
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_get_forbidden(
        #[case] app: TestApp,
        #[case] project_id: i64,
        #[case] user: authz::identity::User,
    ) {
        // Remove this condition when feature is done
        if !enable_project_perm() && user.info.name == "User2" {
            return;
        }

        app.get(&format!("/projects/{}", project_id))
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_get_not_found() {
        let app = test_app!().build();
        let project_id = create_project(&mut app.db_pool().get_ok(), "project")
            .await
            .id;
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.get(&format!("/projects/{}", project_id + 1000))
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_delete() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        app.delete(format!("/projects/{}", created_project.id).as_str())
            .await
            .assert_status_no_content();

        let exists = Project::exists(&mut db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to check if project exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn project_patch() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let updated_name = "rename_test";
        let updated_budget = 20000;

        let response: ProjectWithStudyCount = app
            .patch(format!("/projects/{}", created_project.id).as_str())
            .json(&json!({
                "name": updated_name,
                "budget": updated_budget
            }))
            .await
            .assert_status_ok()
            .json();

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
        let app = test_app!().skip_authz().build();
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
        app.patch(format!("/projects/{}", project.id).as_str())
            .json(&json!({
                "image": image.id
            }))
            .await
            .assert_status_ok();

        check_image(db_pool.get_ok(), Some(image.id)).await;

        // now we update it
        let old_image = image;
        let new_image = Document::changeset()
            .content_type("image/png".to_owned())
            .data(data.to_vec())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create new image");

        app.patch(format!("/projects/{}", project.id).as_str())
            .json(&json!({
                "image": new_image.id
            }))
            .await
            .assert_status_ok();

        check_image(db_pool.get_ok(), Some(new_image.id)).await;
        assert!(
            !Document::exists(&mut db_pool.get_ok(), old_image.id)
                .await
                .unwrap()
        );

        // now we remove the image
        app.patch(format!("/projects/{}", project.id).as_str())
            .json(&json!({
                "image": null
            }))
            .await
            .assert_status_ok();

        check_image(db_pool.get_ok(), None).await;
        assert!(
            !Document::exists(&mut db_pool.get_ok(), new_image.id)
                .await
                .unwrap()
        );
    }
}
