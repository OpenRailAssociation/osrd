use crate::decl_paginated_response;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Create;
use crate::models::Delete;
use crate::models::List;
use crate::models::Project;
use crate::models::Retrieve;
use crate::models::Study;
use crate::models::StudyWithScenarios;
use crate::models::Update;
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
    pub tags: Vec<String>,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub study_type: String,
}

impl StudyCreateForm {
    pub fn into_study(self, project_id: i64) -> Result<Study> {
        let res = Study {
            name: Some(self.name),
            project_id: Some(project_id),
            description: Some(self.description),
            budget: Some(self.budget),
            tags: Some(self.tags),
            creation_date: Some(Utc::now().naive_utc()),
            business_code: Some(self.business_code),
            service_code: Some(self.service_code),
            state: Some(self.state),
            study_type: Some(self.study_type),
            start_date: Some(self.start_date),
            expected_end_date: Some(self.expected_end_date),
            actual_end_date: Some(self.actual_end_date),
            ..Default::default()
        };
        res.validate()?;
        Ok(res)
    }
}

#[utoipa::path(
    tag = "studies",
    params(ProjectIdParam),
    request_body = StudyCreateForm,
    responses(
        (status = 201, body = StudyWithScenarios, description = "The created study"),
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<StudyCreateForm>,
    project: Path<i64>,
) -> Result<Json<StudyWithScenarios>> {
    let project_id = project.into_inner();
    // Check if project exists
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        None => return Err(ProjectError::NotFound { project_id }.into()),
        Some(project) => project,
    };

    // Create study
    let study: Study = data.into_inner().into_study(project_id)?;
    let study = study.create(db_pool.clone()).await?;

    // Update project last_modification field
    let project = project.update_last_modified(db_pool).await?;
    project.expect("Project should exist");

    // Return study with list of scenarios
    let study_with_scenarios = StudyWithScenarios {
        study,
        scenarios_count: 0,
    };

    Ok(Json(study_with_scenarios))
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
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        None => return Err(ProjectError::NotFound { project_id }.into()),
        Some(project) => project,
    };

    // Delete study
    if !Study::delete(db_pool.clone(), study_id).await? {
        return Err(StudyError::NotFound { study_id }.into());
    }

    // Update project last_modification field
    let project = project.update_last_modified(db_pool).await?;
    project.expect("Project should exist");

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
    let project = project.into_inner();
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let ordering = params.ordering.clone();
    let studies = StudyWithScenarios::list(db_pool, page, per_page, (project, ordering)).await?;

    Ok(Json(studies))
}

/// Return a specific study
#[utoipa::path(
    tag = "studies",
    params(ProjectIdParam, StudyIdParam),
    responses(
        (status = 200, body = StudyWithScenarios, description = "The requested study"),
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
#[get("")]
async fn get(db_pool: Data<DbPool>, path: Path<(i64, i64)>) -> Result<Json<StudyWithScenarios>> {
    let (project_id, study_id) = path.into_inner();

    // Check if project exists
    if Project::retrieve(db_pool.clone(), project_id)
        .await?
        .is_none()
    {
        return Err(ProjectError::NotFound { project_id }.into());
    };

    // Return the studies
    let study = match Study::retrieve(db_pool.clone(), study_id).await? {
        Some(study) => study,
        None => return Err(StudyError::NotFound { study_id }.into()),
    };
    let study_scenarios = study.with_scenarios(db_pool).await?;
    Ok(Json(study_scenarios))
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
    pub tags: Option<Vec<String>>,
    pub state: Option<String>,
    pub study_type: Option<String>,
}

impl TryFrom<StudyPatchForm> for Study {
    type Error = crate::error::InternalError;

    fn try_from(form: StudyPatchForm) -> std::result::Result<Self, Self::Error> {
        let res = Study {
            name: form.name,
            description: form.description,
            start_date: Some(form.start_date),
            expected_end_date: Some(form.expected_end_date),
            actual_end_date: Some(form.actual_end_date),
            budget: form.budget,
            business_code: form.business_code,
            service_code: form.service_code,
            state: form.state,
            tags: form.tags,
            study_type: form.study_type,
            ..Default::default()
        };
        res.validate()?;
        Ok(res)
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
        (status = 200, body = StudyWithScenarios, description = "The updated study"),
        (status = 404, body = InternalError, description = "The requested study was not found"),
    )
)]
#[patch("")]
async fn patch(
    data: Json<StudyPatchForm>,
    path: Path<(i64, i64)>,
    db_pool: Data<DbPool>,
) -> Result<Json<StudyWithScenarios>> {
    let (project_id, study_id) = path.into_inner();

    let mut conn = db_pool.get().await?;
    let study_scenarios = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project exists
                let project = match Project::retrieve_conn(conn, project_id).await? {
                    None => return Err(ProjectError::NotFound { project_id }.into()),
                    Some(project) => project,
                };

                // Update study
                let study: Study = data.into_inner().try_into()?;
                let study = match study.update_conn(conn, study_id).await? {
                    Some(study) => study,
                    None => return Err(StudyError::NotFound { study_id }.into()),
                };

                study.validate()?;

                // Update project last_modification field
                let project = project.update_last_modified_conn(conn).await?;
                project.expect("Project should exist");

                study.with_scenarios_conn(conn).await
            }
            .scope_boxed()
        })
        .await?;
    Ok(Json(study_scenarios))
}

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{
        db_pool, project, study_fixture_set, StudyFixtureSet, TestFixture,
    };
    use crate::models::Project;
    use crate::models::Study;
    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    fn study_url(study_fixture_set: &StudyFixtureSet, detail: bool) -> String {
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

    fn delete_study_request(study_fixture_set: &StudyFixtureSet) -> Request {
        TestRequest::delete()
            .uri(study_url(study_fixture_set, true).as_str())
            .to_request()
    }

    #[rstest]
    async fn study_create(#[future] project: TestFixture<Project>, db_pool: Data<DbPool>) {
        let app = create_test_service().await;
        let project = project.await;
        let req = TestRequest::post()
            .uri(format!("/projects/{}/studies/", project.id()).as_str())
            .set_json(json!({ "name": "study_test" }))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let study: Study = read_body_json(response).await;
        assert_eq!(study.name.unwrap(), "study_test");

        assert!(Study::delete(db_pool, study.id.unwrap()).await.unwrap());
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
            .uri(study_url(&study_fixture_set.await, false).as_str())
            .to_request();

        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn study_get(#[future] study_fixture_set: StudyFixtureSet, db_pool: Data<DbPool>) {
        let app = create_test_service().await;
        let study_fixture_set = study_fixture_set.await;

        let url = study_url(&study_fixture_set, true);

        let req = TestRequest::get().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        assert!(Study::delete(db_pool, study_fixture_set.study.id())
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
            .uri(study_url(&study_fixture_set, true).as_str())
            .set_json(json!({"name": "rename_test", "budget":20000}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let StudyWithScenarios { study, .. } = read_body_json(response).await;
        assert_eq!(study.name.unwrap(), "rename_test");
    }
}
