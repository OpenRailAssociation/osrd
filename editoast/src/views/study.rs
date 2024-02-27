use crate::decl_paginated_response;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::List;
use crate::modelsv2::{Changeset, Create, DeleteStatic, Model, Project, Study, Tags, Update};
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::views::projects::ProjectError;
use crate::views::projects::ProjectIdParam;
use crate::views::projects::QueryParams;
use crate::DbPool;
use actix_web::patch;
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, post, HttpResponse};
use chrono::NaiveDate;
use chrono::Utc;
use derivative::Derivative;
use diesel_async::scoped_futures::ScopedFutureExt;
use diesel_async::AsyncConnection;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::scenario;

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

crate::schemas! {
    Study,
    StudyCreateForm,
    StudyPatchForm,
    StudyWithScenarios,
    PaginatedResponseOfStudyWithScenarios,
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

/// This structure is used by the post endpoint to create a study
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct StudyCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub start_date: Option<NaiveDate>,
    pub expected_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,
    #[serde(default)]
    pub business_code: String,
    #[serde(default)]
    pub service_code: String,
    #[serde(default)]
    pub budget: i32,
    #[serde(default)]
    pub tags: Tags,
    pub state: String,
    #[serde(default)]
    pub study_type: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StudyWithScenarios {
    #[serde(flatten)]
    pub study: Study,
    pub scenarios_count: i64,
}

impl StudyWithScenarios {
    pub fn new(study: Study, scenarios_count: i64) -> Self {
        Self {
            study,
            scenarios_count,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StudyResponse {
    #[serde(flatten)]
    pub study: Study,
    pub scenarios_count: i64,
    pub project: Project,
}

impl StudyResponse {
    pub fn new(study_scenarios: StudyWithScenarios, project: Project) -> Self {
        Self {
            study: study_scenarios.study,
            scenarios_count: study_scenarios.scenarios_count,
            project,
        }
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
    db_pool: Data<DbPool>,
    data: Json<StudyCreateForm>,
    project: Path<i64>,
) -> Result<Json<StudyResponse>> {
    let project_id = project.into_inner();

    let conn = &mut db_pool.get().await?;

    let (study, project) = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project exists
                use crate::modelsv2::Retrieve;
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
async fn delete(path: Path<(i64, i64)>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let (project_id, study_id) = path.into_inner();
    // Check if project exists
    let conn = &mut db_pool.get().await?;
    use crate::modelsv2::Retrieve;
    let mut project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;

    // Delete study
    Study::delete_static_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    // Update project last_modification field
    project.update_last_modified(conn).await?;

    Ok(HttpResponse::NoContent().finish())
}

decl_paginated_response!(PaginatedResponseOfStudyWithScenarios, StudyWithScenarios);

/// Return a list of studies
#[utoipa::path(
    tag = "studies",
    params(ProjectIdParam, PaginationQueryParam, QueryParams),
    responses(
        (status = 200, body = PaginatedResponseOfStudyWithScenarios, description = "The list of studies"),
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
    project: Path<i64>,
    params: Query<QueryParams>,
) -> Result<Json<PaginatedResponse<StudyWithScenarios>>> {
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let project = project.into_inner();
    let ordering = params.ordering.clone();
    let studies = Study::list(db_pool.clone(), page, per_page, (project, ordering)).await?;

    let mut results = Vec::new();
    for study in studies.results.into_iter() {
        let scenarios_count = study.scenarios_count(db_pool.clone()).await?;
        results.push(StudyWithScenarios::new(study, scenarios_count));
    }

    Ok(Json(PaginatedResponse {
        count: studies.count,
        previous: studies.previous,
        next: studies.next,
        results,
    }))
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
async fn get(db_pool: Data<DbPool>, path: Path<(i64, i64)>) -> Result<Json<StudyResponse>> {
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

    let scenarios_count = study.scenarios_count(db_pool.clone()).await?;
    let study_scenarios = StudyWithScenarios::new(study, scenarios_count);
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
            .flat_description(self.description)
            .flat_business_code(self.business_code)
            .flat_service_code(self.service_code)
            .flat_start_date(Some(self.start_date))
            .flat_expected_end_date(Some(self.expected_end_date))
            .flat_actual_end_date(Some(self.actual_end_date))
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
    db_pool: Data<DbPool>,
) -> Result<Json<StudyResponse>> {
    let (project_id, study_id) = path.into_inner();
    let conn = &mut db_pool.get().await?;
    let (study_scenarios, project) = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project exists
                use crate::modelsv2::Retrieve;
                let mut project = Project::retrieve_or_fail(conn, project_id, || {
                    ProjectError::NotFound { project_id }
                })
                .await?;

                // Update study
                let study = data
                    .into_inner()
                    .into_study_changeset()?
                    .update_or_fail(conn, study_id, || StudyError::NotFound { study_id })
                    .await?;
                let scenarios_count = study.scenarios_count(db_pool.clone()).await?;
                let study_scenarios = StudyWithScenarios::new(study, scenarios_count);

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

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{
        db_pool, project, study_fixture_set, StudyFixtureSet, TestFixture,
    };
    use crate::modelsv2::{DeleteStatic, Project, Study};
    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    fn easy_study_url(study_fixture_set: &StudyFixtureSet, detail: bool) -> String {
        format!(
            "/projects/{project_id}/studies/{study_id}",
            project_id = study_fixture_set.project.id(),
            study_id = if detail {
                study_fixture_set.study.id().to_string()
            } else {
                "".to_string()
            }
        )
    }

    pub fn study_url(project_id: i64, study_id: Option<i64>) -> String {
        format!(
            "/projects/{}/studies/{}",
            project_id,
            study_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    fn delete_study_request(study_fixture_set: &StudyFixtureSet) -> Request {
        TestRequest::delete()
            .uri(easy_study_url(study_fixture_set, true).as_str())
            .to_request()
    }

    #[rstest]
    async fn study_create(#[future] project: TestFixture<Project>, db_pool: Data<DbPool>) {
        let app = create_test_service().await;
        let project = project.await;
        let req = TestRequest::post()
            .uri(format!("/projects/{}/studies/", project.id()).as_str())
            .set_json(json!({ "name": "study_test", "state": "Starting" }))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let study_response: StudyResponse = read_body_json(response).await;
        let study = TestFixture::new(study_response.study, db_pool.clone());
        assert_eq!(study.model.name.clone(), "study_test");
    }

    #[rstest]
    async fn study_delete(#[future] study_fixture_set: StudyFixtureSet) {
        let app = create_test_service().await;
        let study_fixture_set = study_fixture_set.await;

        let response = call_service(&app, delete_study_request(&study_fixture_set)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_study_request(&study_fixture_set)).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn study_list(#[future] study_fixture_set: StudyFixtureSet) {
        let app = create_test_service().await;

        let req = TestRequest::get()
            .uri(easy_study_url(&study_fixture_set.await, false).as_str())
            .to_request();

        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn study_get(#[future] study_fixture_set: StudyFixtureSet, db_pool: Data<DbPool>) {
        let app = create_test_service().await;
        let study_fixture_set = study_fixture_set.await;

        let url = easy_study_url(&study_fixture_set, true);
        let url_project_not_found = study_url(
            study_fixture_set.project.id() + 1,
            Some(study_fixture_set.study.id()),
        );

        let req = TestRequest::get()
            .uri(url_project_not_found.as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let req = TestRequest::get().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let conn = &mut db_pool.get().await.unwrap();
        assert!(Study::delete_static(conn, study_fixture_set.study.id())
            .await
            .unwrap());

        let req = TestRequest::get().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn study_patch(#[future] study_fixture_set: StudyFixtureSet) {
        let app = create_test_service().await;
        let study_fixture_set = study_fixture_set.await;
        let req = TestRequest::patch()
            .uri(easy_study_url(&study_fixture_set, true).as_str())
            .set_json(json!({"name": "rename_test", "budget":20000}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let StudyWithScenarios { study, .. } = read_body_json(response).await;
        assert_eq!(study.name, "rename_test");
    }
}
