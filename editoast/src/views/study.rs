use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use chrono::NaiveDate;
use chrono::Utc;
use derivative::Derivative;
use diesel_async::scoped_futures::ScopedFutureExt;
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
use super::pagination::PaginationStats;
use super::AuthenticationExt;
use super::AuthorizationError;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::Project;
use crate::models::Study;
use crate::models::Tags;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::projects::ProjectError;
use crate::views::projects::ProjectIdParam;

crate::routes! {
    "/studies" => {
        create,
        list,
        "/{study_id}" => {
            get,
            delete,
            patch,
        },
    },
}

editoast_common::schemas! {
    Study,
    StudyCreateForm,
    StudyPatchForm,
    StudyWithScenarioCount,
    StudyResponse,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "study")]
pub enum StudyError {
    /// Couldn't found the study with the given study ID
    #[error("Study '{study_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { study_id: i64 },
    // The study start and end date are in the wrong order
    #[error("The study start date must be before the end date")]
    #[editoast_error(status = 400)]
    StartDateAfterEndDate,
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
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct StudyCreateForm {
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

impl StudyCreateForm {
    pub fn into_study_changeset(self, project_id: i64) -> Result<Changeset<Study>> {
        let study_changeset = Study::changeset()
            .name(self.name)
            .description(self.description)
            .business_code(self.business_code)
            .service_code(self.service_code)
            .creation_date(Utc::now().naive_utc())
            .last_modification(Utc::now().naive_utc())
            .start_date(self.start_date)
            .expected_end_date(self.expected_end_date)
            .actual_end_date(self.actual_end_date)
            .budget(self.budget)
            .tags(self.tags)
            .state(self.state)
            .study_type(self.study_type)
            .project_id(project_id);
        Study::validate(&study_changeset)?;
        Ok(study_changeset)
    }
}

#[utoipa::path(
    post, path = "",
    tag = "studies",
    params(ProjectIdParam),
    request_body = StudyCreateForm,
    responses(
        (status = 201, body = StudyResponse, description = "The created study"),
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
    Json(data): Json<StudyCreateForm>,
) -> Result<Json<StudyResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let connection = db_pool.get().await?;

    let (study, project) = connection
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                // Check if project exists
                let mut project = Project::retrieve_or_fail(&mut conn.clone(), project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;

                // Create study
                let study: Study = data
                    .into_study_changeset(project_id)?
                    .create(&mut conn.clone())
                    .await?;

                // Update project last_modification field
                project.update_last_modified(&mut conn.clone()).await?;

                Ok((study, project))
            }
            .scope_boxed()
        })
        .await?;

    // Return study with list of scenarios
    let study_response = StudyResponse {
        study,
        scenarios_count: 0,
        project,
    };

    Ok(Json(study_response))
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct StudyIdParam {
    study_id: i64,
}

/// Delete a study
#[utoipa::path(
    delete, path = "",
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 204, description = "The study was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    // Check if project exists
    let conn = &mut db_pool.get().await?;
    let mut project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;

    // Delete study
    Study::delete_static_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    // Update project last_modification field
    project.update_last_modified(conn).await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Return a specific study
#[utoipa::path(
    get, path = "",
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 200, body = StudyResponse, description = "The requested study"),
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
) -> Result<Json<StudyResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    // Check if project exists
    let conn = &mut db_pool.get().await?;
    use crate::models::Retrieve;
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;

    // Return the study
    let study =
        Study::retrieve_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    //Check if the study belongs to the project
    if study.project_id != project_id {
        return Err(StudyError::NotFound { study_id }.into());
    }

    let study_scenarios = StudyWithScenarioCount::try_fetch(conn, study).await?;
    let study_response = StudyResponse::new(study_scenarios, project);
    Ok(Json(study_response))
}

/// This structure is used by the patch endpoint to patch a study
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct StudyPatchForm {
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
        Study::validate(&study_changeset)?;
        Ok(study_changeset)
    }
}

/// Update a study
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
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
async fn patch(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
    Json(data): Json<StudyPatchForm>,
) -> Result<Json<StudyResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let connection = db_pool.get().await?;
    let (study_scenarios, project) = connection
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                // Check if project exists
                let mut project = Project::retrieve_or_fail(&mut conn.clone(), project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;

                // Update study
                let study = data
                    .into_study_changeset()?
                    .last_modification(Utc::now().naive_utc())
                    .update_or_fail(&mut conn.clone(), study_id, || StudyError::NotFound {
                        study_id,
                    })
                    .await?;
                let study_scenarios =
                    StudyWithScenarioCount::try_fetch(&mut conn.clone(), study).await?;

                // Update project last_modification field
                project.update_last_modified(&mut conn.clone()).await?;

                Ok((study_scenarios, project))
            }
            .scope_boxed()
        })
        .await?;
    let study_response = StudyResponse::new(study_scenarios, project);
    Ok(Json(study_response))
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
        let scenarios_count = study.scenarios_count(conn).await?;
        Ok(Self {
            study,
            scenarios_count,
        })
    }
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct StudyListResponse {
    #[schema(value_type = Vec<StudyWithScenarios>)]
    results: Vec<StudyWithScenarioCount>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a list of studies
#[utoipa::path(
    get, path = "",
    tag = "studies",
    params(ProjectIdParam, PaginationQueryParams, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(StudyListResponse), description = "The list of studies"),
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(project_id): Path<i64>,
    Query(pagination_params): Query<PaginationQueryParams>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<StudyListResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let ordering = ordering_params.ordering;
    if !Project::exists(&mut db_pool.get().await?, project_id).await? {
        return Err(ProjectError::NotFound { project_id }.into());
    }

    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
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
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::models::fixtures::create_project;
    use crate::models::fixtures::create_study;
    use crate::models::Study;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
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
        let response: StudyResponse = app.fetch(request).assert_status(StatusCode::OK).json_into();

        let study = Study::retrieve(&mut db_pool.get_ok(), response.study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        assert_eq!(study, response.study);
        assert_eq!(study.project_id, created_project.id);
    }

    #[rstest]
    async fn study_list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let created_study =
            create_study(&mut db_pool.get_ok(), "test_study_name", created_project.id).await;

        let request = app.get(&format!("/projects/{}/studies/", created_project.id));

        let response: StudyListResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let studies_retreived = response
            .results
            .iter()
            .find(|r| r.study.id == created_study.id)
            .expect("Study not found");

        assert_eq!(studies_retreived.study, created_study);
    }

    #[rstest]
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

        let response: StudyResponse = app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.study, created_study);
        assert_eq!(response.study.project_id, created_project.id);
        assert_eq!(response.project, created_project);
    }

    #[rstest]
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

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
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

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Study::exists(&mut db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to check if study exists");

        assert!(!exists);
    }

    #[rstest]
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

        app.fetch(request).assert_status(StatusCode::OK);

        let updated_study = Study::retrieve(&mut db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        let updated_project = Project::retrieve(&mut db_pool.get_ok(), created_project.id)
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
