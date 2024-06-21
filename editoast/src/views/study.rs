use std::ops::DerefMut as _;

use actix_web::delete;
use actix_web::get;
use actix_web::patch;
use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::HttpResponse;
use chrono::NaiveDate;
use chrono::Utc;
use derivative::Derivative;
use diesel_async::scoped_futures::ScopedFutureExt;
use diesel_async::AsyncConnection;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::operational_studies::OperationalStudiesOrderingParam;
use super::pagination::PaginationStats;
use super::scenario;
use crate::error::InternalError;
use crate::error::Result;
use crate::modelsv2::prelude::*;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;

use crate::modelsv2::Project;
use crate::modelsv2::Study;
use crate::modelsv2::Tags;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParam;
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
            scenario::routes(),
        }
    }
}

editoast_common::schemas! {
    Study,
    StudyCreateForm,
    StudyPatchForm,
    StudyWithScenarioCount,
    StudyResponse,
    scenario::schemas(),
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
    tag = "studies",
    params(ProjectIdParam),
    request_body = StudyCreateForm,
    responses(
        (status = 201, body = StudyResponse, description = "The created study"),
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbConnectionPoolV2>,
    data: Json<StudyCreateForm>,
    project: Path<i64>,
) -> Result<Json<StudyResponse>> {
    let project_id = project.into_inner();

    let conn = &mut db_pool.get().await?;

    let (study, project) = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project exists
                let mut project = Project::retrieve_or_fail(conn, project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;

                // Create study
                let study: Study = data
                    .into_inner()
                    .into_study_changeset(project_id)?
                    .create(conn)
                    .await?;

                // Update project last_modification field
                project.update_last_modified(conn).await?;

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
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 204, description = "The study was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
#[delete("")]
async fn delete(path: Path<(i64, i64)>, db_pool: Data<DbConnectionPoolV2>) -> Result<HttpResponse> {
    let (project_id, study_id) = path.into_inner();
    // Check if project exists
    let conn = &mut db_pool.get().await?;
    let mut project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;

    // Delete study
    Study::delete_static_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    // Update project last_modification field
    project.update_last_modified(conn).await?;

    Ok(HttpResponse::NoContent().finish())
}

/// Return a specific study
#[utoipa::path(
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 200, body = StudyResponse, description = "The requested study"),
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<(i64, i64)>,
) -> Result<Json<StudyResponse>> {
    let (project_id, study_id) = path.into_inner();

    // Check if project exists
    let conn = &mut db_pool.get().await?;
    use crate::modelsv2::Retrieve;
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
    pub description: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub expected_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,
    pub business_code: Option<String>,
    pub service_code: Option<String>,
    pub budget: Option<i32>,
    pub tags: Option<Tags>,
    pub state: Option<String>,
    pub study_type: Option<String>,
}

impl StudyPatchForm {
    pub fn into_study_changeset(self) -> Result<Changeset<Study>> {
        let study_changeset = Study::changeset()
            .flat_name(self.name)
            .description(self.description)
            .business_code(self.business_code)
            .service_code(self.service_code)
            .flat_start_date(Some(self.start_date))
            .flat_expected_end_date(Some(self.expected_end_date))
            .flat_actual_end_date(Some(self.actual_end_date))
            .flat_budget(Some(self.budget))
            .flat_tags(self.tags)
            .flat_state(self.state)
            .study_type(self.study_type);
        Study::validate(&study_changeset)?;
        Ok(study_changeset)
    }
}

/// Update a study
#[utoipa::path(
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
#[patch("")]
async fn patch(
    data: Json<StudyPatchForm>,
    path: Path<(i64, i64)>,
    db_pool: Data<DbConnectionPoolV2>,
) -> Result<Json<StudyResponse>> {
    let (project_id, study_id) = path.into_inner();
    let conn = &mut db_pool.get().await?;
    let (study_scenarios, project) = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project exists
                let mut project = Project::retrieve_or_fail(conn, project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;

                // Update study
                let study = data
                    .into_inner()
                    .into_study_changeset()?
                    .last_modification(Utc::now().naive_utc())
                    .update_or_fail(conn, study_id, || StudyError::NotFound { study_id })
                    .await?;
                let study_scenarios = StudyWithScenarioCount::try_fetch(conn, study).await?;

                // Update project last_modification field
                project.update_last_modified(conn).await?;

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
    tag = "studies",
    params(ProjectIdParam, PaginationQueryParam, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = inline(StudyListResponse), description = "The list of studies"),
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbConnectionPoolV2>,
    project: Path<i64>,
    Query(pagination_params): Query<PaginationQueryParam>,
    Query(ordering_params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<StudyListResponse>> {
    let ordering = ordering_params.ordering;
    let project_id = project.into_inner();
    if !Project::exists(db_pool.get().await?.deref_mut(), project_id).await? {
        return Err(ProjectError::NotFound { project_id }.into());
    }

    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings()
        .filter(move || Study::PROJECT_ID.eq(project_id))
        .order_by(move || ordering.as_study_ordering());

    let (studies, stats) =
        Study::list_paginated(db_pool.get().await?.deref_mut(), settings).await?;
    let results = studies
        .into_iter()
        .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
        .map(|(project, conn)| async move {
            StudyWithScenarioCount::try_fetch(conn.await?.deref_mut(), project).await
        });
    let results = futures::future::try_join_all(results).await?;

    Ok(Json(StudyListResponse { results, stats }))
}

#[cfg(test)]
pub mod test {
    use actix_web::http::StatusCode;
    use actix_web::test::TestRequest;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::modelsv2::fixtures::create_project;
    use crate::modelsv2::fixtures::create_study;
    use crate::modelsv2::Study;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn study_post() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let request = TestRequest::post()
            .uri(&format!("/projects/{}/studies/", created_project.id))
            .set_json(json!({
                "name": "study_test",
                "description": "Study description",
                "state": "Starting",
                "business_code": "",
                "service_code": "",
                "study_type": "",
            }))
            .to_request();

        let response: StudyResponse = app.fetch(request).assert_status(StatusCode::OK).json_into();

        let study = Study::retrieve(db_pool.get_ok().deref_mut(), response.study.id)
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

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let created_study = create_study(
            db_pool.get_ok().deref_mut(),
            "test_study_name",
            created_project.id,
        )
        .await;

        let request = TestRequest::get()
            .uri(&format!("/projects/{}/studies/", created_project.id))
            .to_request();

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

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let created_study = create_study(
            db_pool.get_ok().deref_mut(),
            "test_study_name",
            created_project.id,
        )
        .await;

        let request = TestRequest::get()
            .uri(&format!(
                "/projects/{}/studies/{}",
                created_project.id, created_study.id
            ))
            .to_request();

        let response: StudyResponse = app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.study, created_study);
        assert_eq!(response.study.project_id, created_project.id);
        assert_eq!(response.project, created_project);
    }

    #[rstest]
    async fn study_get_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let created_study = create_study(
            db_pool.get_ok().deref_mut(),
            "test_study_name",
            created_project.id,
        )
        .await;

        let request = TestRequest::get()
            .uri(&format!(
                "/projects/{}/studies/{}",
                created_project.id,
                created_study.id + 1000
            ))
            .to_request();

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn study_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let created_study = create_study(
            db_pool.get_ok().deref_mut(),
            "test_study_name",
            created_project.id,
        )
        .await;

        let request = TestRequest::delete()
            .uri(&format!(
                "/projects/{}/studies/{}",
                created_project.id, created_study.id
            ))
            .to_request();

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Study::exists(db_pool.get_ok().deref_mut(), created_study.id)
            .await
            .expect("Failed to check if study exists");

        assert!(!exists);
    }

    #[rstest]
    async fn study_patch() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_project =
            create_project(db_pool.get_ok().deref_mut(), "test_project_name").await;

        let created_study = create_study(
            db_pool.get_ok().deref_mut(),
            "test_study_name",
            created_project.id,
        )
        .await;

        let study_name = "rename_test";
        let study_budget = 20000;

        let request = TestRequest::patch()
            .uri(&format!(
                "/projects/{}/studies/{}",
                created_project.id, created_study.id
            ))
            .set_json(json!({
                "name": study_name,
                "budget": study_budget,
            }))
            .to_request();

        app.fetch(request).assert_status(StatusCode::OK);

        let updated_study = Study::retrieve(db_pool.get_ok().deref_mut(), created_study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        let updated_project = Project::retrieve(db_pool.get_ok().deref_mut(), created_project.id)
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
