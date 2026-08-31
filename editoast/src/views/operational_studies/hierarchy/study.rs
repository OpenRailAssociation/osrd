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
use chrono::NaiveDate;
use chrono::Utc;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::OperationalStudiesOrderingParam;
use super::project::ProjectError;
use crate::AppState;
use crate::authentication;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::operational_studies::hierarchy::ENABLER;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use models::prelude::*;
use models::project::Error as ProjectModelError;
use models::project::Project;
use models::study::Error as StudyModelError;
use models::study::Study;
use models::tags::Tags;

fn validate_study_dates(
    start: Option<NaiveDate>,
    expected_end: Option<NaiveDate>,
    actual_end: Option<NaiveDate>,
) -> Result<(), &'static str> {
    if let Some((start, expected_end)) = start.zip(expected_end)
        && start > expected_end
    {
        return Err("The study start date must be before the expected end date");
    }
    if let Some((start, actual_end)) = start.zip(actual_end)
        && start > actual_end
    {
        return Err("The study start date must be before the actual end date");
    }
    Ok(())
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "study")]
pub enum StudyError {
    #[error("Study '{study_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { study_id: i64 },
    #[error("Project '{project_id}' could not be found")]
    #[editoast_error(status = 404)]
    ProjectNotFound { project_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(models::Error, database::DatabaseError)]
    Database(models::Error),
}

impl From<StudyModelError> for StudyError {
    fn from(e: StudyModelError) -> Self {
        match e {
            StudyModelError::NotFound { study_id } => StudyError::NotFound { study_id },
            StudyModelError::Database(db_err) => StudyError::Database(db_err),
        }
    }
}

impl From<ProjectModelError> for StudyError {
    fn from(e: ProjectModelError) -> Self {
        match e {
            ProjectModelError::NotFound { project_id } => {
                StudyError::ProjectNotFound { project_id }
            }
            ProjectModelError::Database(db_err) => StudyError::Database(db_err),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StudyResponse {
    #[serde(flatten)]
    pub study: Study,
    pub scenarios_count: u64,
    pub project: Project,
}

impl StudyResponse {
    pub fn new(study_scenarios: StudyWithScenarioCount, project: Project) -> Self {
        Self {
            study: study_scenarios.study,
            scenarios_count: study_scenarios.scenarios_count,
            project,
        }
    }
}

/// This structure is used by the post endpoint to create a study
#[derive(Deserialize, Default, ToSchema)]
#[serde(remote = "Self")]
pub(in crate::views) struct StudyCreateForm {
    pub name: String,
    pub description: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub expected_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,
    pub business_code: Option<String>,
    pub service_code: Option<String>,
    pub budget: Option<i32>,
    #[serde(default)]
    pub tags: Tags,
    pub state: String,
    pub study_type: Option<String>,
    pub project_id: i64,
}

impl<'de> Deserialize<'de> for StudyCreateForm {
    fn deserialize<D>(deserializer: D) -> Result<StudyCreateForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let form = StudyCreateForm::deserialize(deserializer)?;
        validate_study_dates(
            form.start_date,
            form.expected_end_date,
            form.actual_end_date,
        )
        .map_err(<D::Error as serde::de::Error>::custom)?;
        Ok(form)
    }
}

impl StudyCreateForm {
    pub fn into_study_changeset(self) -> Changeset<Study> {
        Study::changeset()
            .name(self.name)
            .description(self.description)
            .business_code(self.business_code)
            .service_code(self.service_code)
            .creation_date(Utc::now())
            .last_modification(Utc::now())
            .start_date(self.start_date)
            .expected_end_date(self.expected_end_date)
            .actual_end_date(self.actual_end_date)
            .budget(self.budget)
            .tags(self.tags)
            .state(self.state)
            .study_type(self.study_type)
            .project_id(self.project_id)
    }
}

/// Create a new study
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "studies",
    request_body = StudyCreateForm,
    responses(
        (status = 201, body = StudyWithScenarioCount, description = "The created study"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(data): Json<StudyCreateForm>,
) -> Result<impl IntoResponse> {
    let study = Project::transactional_content_update(
        db_pool.get().await?,
        data.project_id,
        async move |mut conn, _project| {
            let study = data.into_study_changeset().create(&mut conn).await?;
            Ok::<_, InternalError>(study)
        },
    )
    .await
    .map_err(StudyError::from)??;

    // Return study with list of scenarios
    let study_response = StudyWithScenarioCount {
        study,
        scenarios_count: 0,
    };

    Ok((StatusCode::CREATED, Json(study_response)))
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct StudyIdParam {
    study_id: i64,
}

/// Delete a study
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "studies",
    params(StudyIdParam),
    responses(
        (status = 204, description = "The study was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(StudyIdParam { study_id }): Path<StudyIdParam>,
) -> Result<impl IntoResponse> {
    let conn = db_pool.get().await?;

    conn.transaction(async move |conn| {
        let study =
            Study::retrieve_or_fail(conn.clone(), study_id, || StudyError::NotFound { study_id })
                .await?;

        Project::transactional_content_update(conn, study.project_id, async move |mut conn, _| {
            Study::delete_static_or_fail(&mut conn, study_id, || StudyError::NotFound { study_id })
                .await?;
            Ok::<_, StudyError>(())
        })
        .await
        .map_err(StudyError::from)??;

        Ok::<_, StudyError>(())
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Return a specific study
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "studies",
    params(StudyIdParam),
    responses(
        (status = 200, body = StudyResponse, description = "The requested study"),
    )
)]
pub(in crate::views) async fn get(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Path(StudyIdParam { study_id }): Path<StudyIdParam>,
) -> Result<Json<StudyResponse>> {
    let (study_scenarios, project) = db_pool
        .get()
        .await?
        .transaction(async move |conn| {
            let study = Study::retrieve_or_fail(conn.clone(), study_id, || StudyError::NotFound {
                study_id,
            })
            .await?;
            let project = Project::retrieve_or_fail(conn.clone(), study.project_id, || {
                ProjectError::NotFound {
                    project_id: study.project_id,
                }
            })
            .await?;

            let study_scenarios = StudyWithScenarioCount::try_fetch(conn, study).await?;
            Ok::<_, InternalError>((study_scenarios, project))
        })
        .await?;

    if *ENABLER {
        project_privilege_check(authz::Project(project.id), ProjectPrivilege::HasAccess)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await?;
    }

    let study_response = StudyResponse::new(study_scenarios, project);
    Ok(Json(study_response))
}

/// This structure is used by the patch endpoint to patch a study
#[derive(Deserialize, Default, ToSchema)]
#[serde(remote = "Self")]
pub(in crate::views) struct StudyPatchForm {
    pub name: Option<String>,
    #[serde(default, with = "double_option")]
    pub description: Option<Option<String>>,
    #[serde(default, with = "double_option")]
    pub start_date: Option<Option<NaiveDate>>,
    #[serde(default, with = "double_option")]
    pub expected_end_date: Option<Option<NaiveDate>>,
    #[serde(default, with = "double_option")]
    pub actual_end_date: Option<Option<NaiveDate>>,
    #[serde(default, with = "double_option")]
    pub business_code: Option<Option<String>>,
    #[serde(default, with = "double_option")]
    pub service_code: Option<Option<String>>,
    #[serde(default, with = "double_option")]
    pub budget: Option<Option<i32>>,
    pub tags: Option<Tags>,
    pub state: Option<String>,
    #[serde(default, with = "double_option")]
    pub study_type: Option<Option<String>>,
}

impl<'de> Deserialize<'de> for StudyPatchForm {
    fn deserialize<D>(deserializer: D) -> Result<StudyPatchForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let form = StudyPatchForm::deserialize(deserializer)?;
        validate_study_dates(
            form.start_date.flatten(),
            form.expected_end_date.flatten(),
            form.actual_end_date.flatten(),
        )
        .map_err(<D::Error as serde::de::Error>::custom)?;
        Ok(form)
    }
}

impl StudyPatchForm {
    pub fn into_study_changeset(self) -> Result<Changeset<Study>> {
        let study_changeset = Study::changeset()
            .flat_name(self.name)
            .flat_description(self.description)
            .flat_business_code(self.business_code)
            .flat_service_code(self.service_code)
            .flat_start_date(self.start_date)
            .flat_expected_end_date(self.expected_end_date)
            .flat_actual_end_date(self.actual_end_date)
            .flat_budget(self.budget)
            .flat_tags(self.tags)
            .flat_state(self.state)
            .flat_study_type(self.study_type);
        Ok(study_changeset)
    }
}

/// Update a study
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    patch, path = "",
    tag = "studies",
    params(StudyIdParam),
    request_body(
        content = StudyPatchForm,
        description = "The fields to update"
    ),
    responses(
        (status = 200, body = StudyWithScenarioCount, description = "The updated study"),
    )
)]
pub(in crate::views) async fn patch(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(StudyIdParam { study_id }): Path<StudyIdParam>,
    Json(data): Json<StudyPatchForm>,
) -> Result<Json<StudyWithScenarioCount>> {
    let response = Study::transactional_content_update(
        db_pool.get().await?,
        study_id,
        async move |mut conn, _study, _project| {
            let study = data
                .into_study_changeset()?
                .update_or_fail(&mut conn, study_id, || StudyError::NotFound { study_id })
                .await?;
            let study_scenarios = StudyWithScenarioCount::try_fetch(conn, study).await?;
            Ok::<_, InternalError>(study_scenarios)
        },
    )
    .await
    .map_err(StudyError::from)??;

    Ok(Json(response))
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = StudyWithScenarios)]
pub struct StudyWithScenarioCount {
    #[serde(flatten)]
    pub study: Study,
    pub scenarios_count: u64,
}

impl StudyWithScenarioCount {
    pub async fn try_fetch(conn: DbConnection, study: Study) -> Result<Self> {
        let scenarios_count = study
            .scenarios_count(conn)
            .await
            .map_err(StudyError::from)?;
        Ok(Self {
            study,
            scenarios_count,
        })
    }
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct StudyListResponse {
    results: Vec<StudyWithScenarioCount>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[derive(IntoParams, Deserialize)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ListStudiesQueryParams {
    #[param(inline)]
    project_id: i64,
}

/// Return a list of studies
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "studies",
    params(ListStudiesQueryParams, PaginationQueryParams<1000>, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(StudyListResponse), description = "The list of studies"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Query(ListStudiesQueryParams { project_id }): Query<ListStudiesQueryParams>,
    Query(pagination_params): Query<PaginationQueryParams<1000>>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<StudyListResponse>> {
    let ordering = ordering_params.ordering;
    match Project::exists(&mut db_pool.get().await?, project_id).await {
        Ok(true) => (),
        Ok(false) => return Err(ProjectError::NotFound { project_id }.into()),
        Err(err) => return Err(err.into()),
    }

    let settings = pagination_params
        .into_selection_settings()
        .filter(move || Study::PROJECT_ID.eq(project_id))
        .order_by(move || ordering.as_study_ordering());

    let (studies, stats) = Study::list_paginated(&mut db_pool.get().await?, settings).await?;
    let results = studies
        .into_iter()
        .zip(db_pool.iter_conn())
        .map(|(project, conn)| async move {
            StudyWithScenarioCount::try_fetch(conn.await?, project).await
        });
    let results = futures::future::try_join_all(results).await?;

    Ok(Json(StudyListResponse { results, stats }))
}

#[cfg(test)]
pub mod tests {
    use authz::ProjectGrant;
    use models::study::Study;
    use pretty_assertions::assert_eq;

    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::fixtures::create_project;
    use crate::fixtures::create_study;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt as _;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_post() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let response: StudyWithScenarioCount = app
            .post("/studies/")
            .json(&json!({
                "name": "study_test",
                "description": "Study description",
                "state": "Starting",
                "business_code": "",
                "service_code": "",
                "study_type": "",
                "project_id": created_project.id,
            }))
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        let study = Study::retrieve(db_pool.get_ok(), response.study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        assert_eq!(study, response.study);
        assert_eq!(study.project_id, created_project.id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_list() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let response: StudyListResponse = app
            .get("/studies")
            .add_query_param("project_id", created_project.id)
            .await
            .assert_status_ok()
            .json();

        let studies_retrieved = response
            .results
            .iter()
            .find(|r| r.study.id == created_study.id)
            .expect("Study not found");

        assert_eq!(studies_retrieved.study, created_study);
    }

    #[rstest]
    #[case::owner(
        test_app!().build(),
        create_project(&mut app.db_pool().get_ok(), "project").await.id,
        create_study(&mut app.db_pool().get_ok(), "study", project_id).await,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_project_grant(project_id, ProjectGrant::Owner)
            .create()
            .await
    )]
    #[case::admin(
        test_app!().build(),
        create_project(&mut app.db_pool().get_ok(), "project").await.id,
        create_study(&mut app.db_pool().get_ok(), "study", project_id).await,
        app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_get(
        #[case] app: TestApp,
        #[case] project_id: i64,
        #[case] study: Study,
        #[case] user: authz::identity::User,
    ) {
        let response: StudyResponse = app
            .get(&format!("/studies/{}", study.id))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.study, study);
        assert_eq!(response.study.project_id, project_id);
    }

    #[rstest]
    #[case::no_role(
        test_app!().build(),
        app.db_pool().get_ok(),
        create_project(&mut conn.clone(), "project").await.id,
        app
            .user("user", "User")
            .with_project_grant(project_id, ProjectGrant::Owner)
            .create()
            .await
    )]
    #[case::no_grant(
        test_app!().build(),
        app.db_pool().get_ok(),
        create_project(&mut conn.clone(), "project").await.id,
        app
            .user("user2", "User2")
            .with_roles([Role::OperationalStudies])
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_get_forbidden_no_grant(
        #[case] app: TestApp,
        #[case] mut conn: DbConnection,
        #[case] project_id: i64,
        #[case] user: authz::identity::User,
    ) {
        // Remove this condition when feature is done
        // if !enable_project_perm() && user.info.name == "User2" {
        // return;
        // }

        let study_id = create_study(&mut conn, "study", project_id).await.id;

        app.get(&format!("/studies/{}", study_id))
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_get_not_found() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();

        let created_project = create_project(&mut conn.clone(), "test_project_name").await;
        let created_study = create_study(&mut conn, "test_study_name", created_project.id).await;
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.get(&format!("/studies/{}", created_study.id + 1000))
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_delete() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        app.delete(&format!("/studies/{}", created_study.id))
            .await
            .assert_status_no_content();

        let exists = Study::exists(&mut db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to check if study exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_patch() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let study_name = "rename_test";
        let study_budget = 20000;

        app.patch(&format!("/studies/{}", created_study.id))
            .json(&json!({
                "name": study_name,
                "budget": study_budget,
            }))
            .await
            .assert_status_ok();

        let updated_study = Study::retrieve(db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        let updated_project = Project::retrieve(db_pool.get_ok(), created_project.id)
            .await
            .expect("Failed to retrieve project")
            .expect("Project not found");

        assert_eq!(updated_study.name, study_name);
        assert_eq!(updated_study.budget, Some(study_budget));
        assert_eq!(updated_study.project_id, created_project.id);
        // Check that the last modification date of the study and the project have been updated
        assert!(updated_project.last_modification > created_project.last_modification);
        assert!(updated_study.last_modification > created_study.last_modification);
    }
}
