use authz::Role;
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
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AuthenticationExt;
use super::AuthorizationError;
use super::operational_studies::OperationalStudiesOrderingParam;
use super::pagination::PaginationStats;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Project;
use crate::models::Study;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::project::ProjectError;
use crate::views::project::ProjectIdParam;
use editoast_models::prelude::*;
use editoast_models::tags::Tags;

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

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "study")]
pub enum StudyError {
    /// Couldn't found the study with the given study ID
    #[error("Study '{study_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { study_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
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
    pub fn into_study_changeset(self, project_id: i64) -> Result<Changeset<Study>> {
        let study_changeset = Study::changeset()
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
            .project_id(project_id);
        Ok(study_changeset)
    }
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "studies",
    params(ProjectIdParam),
    request_body = StudyCreateForm,
    responses(
        (status = 201, body = StudyResponse, description = "The created study"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
    Json(data): Json<StudyCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let (study, project) = Project::transactional_content_update(
        db_pool.get().await?,
        project_id,
        |mut conn, project| {
            async move {
                let study = data
                    .into_study_changeset(project.id)?
                    .create(&mut conn)
                    .await?;
                Ok::<_, InternalError>((study, project))
            }
            .scope_boxed()
        },
    )
    .await?;

    // Return study with list of scenarios
    let study_response = StudyResponse {
        study,
        scenarios_count: 0,
        project,
    };

    Ok((StatusCode::CREATED, Json(study_response)))
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct StudyIdParam {
    study_id: i64,
}

/// Delete a study
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 204, description = "The study was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    Project::transactional_content_update(db_pool.get().await?, project_id, |mut conn, _| {
        async move {
            Study::delete_static_or_fail(&mut conn, study_id, || StudyError::NotFound { study_id })
                .await?;
            Ok::<_, StudyError>(())
        }
        .scope_boxed()
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Return a specific study
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 200, body = StudyResponse, description = "The requested study"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
) -> Result<Json<StudyResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let (project, study_scenarios) = db_pool
        .get()
        .await?
        .transaction(|mut conn| {
            async move {
                let project = Project::retrieve_or_fail(conn.clone(), project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;
                let study = Study::retrieve_or_fail(conn.clone(), study_id, || {
                    StudyError::NotFound { study_id }
                })
                .await?;

                // Check if the study belongs to the project
                if study.project_id != project_id {
                    return Err::<_, InternalError>(StudyError::NotFound { study_id }.into());
                }

                let study_scenarios = StudyWithScenarioCount::try_fetch(&mut conn, study).await?;
                Ok((project, study_scenarios))
            }
            .scope_boxed()
        })
        .await?;

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
#[editoast_derive::route]
#[utoipa::path(
    patch, path = "",
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    request_body(
        content = StudyPatchForm,
        description = "The fields to update"
    ),
    responses(
        (status = 200, body = StudyResponse, description = "The updated study"),
    )
)]
pub(in crate::views) async fn patch(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
    Json(data): Json<StudyPatchForm>,
) -> Result<Json<StudyResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let (response, project) = Study::transactional_content_update(
        db_pool.get().await?,
        study_id,
        move |mut conn, _study, project| {
            async move {
                if project.id != project_id {
                    return Err::<_, InternalError>(StudyError::NotFound { study_id }.into());
                }
                let study = data
                    .into_study_changeset()?
                    .update_or_fail(&mut conn, study_id, || StudyError::NotFound { study_id })
                    .await?;
                let study_scenarios = StudyWithScenarioCount::try_fetch(&mut conn, study).await?;
                Ok::<_, InternalError>((study_scenarios, project))
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok(Json(StudyResponse::new(response, project)))
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = StudyWithScenarios)]
pub struct StudyWithScenarioCount {
    #[serde(flatten)]
    pub study: Study,
    pub scenarios_count: u64,
}

impl StudyWithScenarioCount {
    pub async fn try_fetch(conn: &mut DbConnection, study: Study) -> Result<Self> {
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

/// Return a list of studies
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "studies",
    params(ProjectIdParam, PaginationQueryParams<1000>, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(StudyListResponse), description = "The list of studies"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
    Query(pagination_params): Query<PaginationQueryParams<1000>>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<StudyListResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
            StudyWithScenarioCount::try_fetch(&mut conn.await?, project).await
        });
    let results = futures::future::try_join_all(results).await?;

    Ok(Json(StudyListResponse { results, stats }))
}

#[cfg(test)]
pub mod tests {
    use pretty_assertions::assert_eq;

    use serde_json::json;

    use super::*;
    use crate::models::Study;
    use crate::models::fixtures::create_project;
    use crate::models::fixtures::create_study;
    use crate::views::test_app::TestAppBuilder;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_post() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let request = app
            .post(&format!("/projects/{}/studies/", created_project.id))
            .json(&json!({
                "name": "study_test",
                "description": "Study description",
                "state": "Starting",
                "business_code": "",
                "service_code": "",
                "study_type": "",
            }));
        let response: StudyResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let study = Study::retrieve(db_pool.get_ok(), response.study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        assert_eq!(study, response.study);
        assert_eq!(study.project_id, created_project.id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let request = app.get(&format!("/projects/{}/studies/", created_project.id));

        let response: StudyListResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let studies_retrieved = response
            .results
            .iter()
            .find(|r| r.study.id == created_study.id)
            .expect("Study not found");

        assert_eq!(studies_retrieved.study, created_study);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}",
            created_project.id, created_study.id
        ));

        let response: StudyResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.study, created_study);
        assert_eq!(response.study.project_id, created_project.id);
        assert_eq!(response.project, created_project);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_get_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}",
            created_project.id,
            created_study.id + 1000
        ));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let request = app.delete(&format!(
            "/projects/{}/studies/{}",
            created_project.id, created_study.id
        ));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = Study::exists(&mut db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to check if study exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_patch() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let study_name = "rename_test";
        let study_budget = 20000;

        let request = app
            .patch(&format!(
                "/projects/{}/studies/{}",
                created_project.id, created_study.id
            ))
            .json(&json!({
                "name": study_name,
                "budget": study_budget,
            }));

        app.fetch(request).await.assert_status(StatusCode::OK);

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
