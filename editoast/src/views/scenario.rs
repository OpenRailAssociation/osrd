use crate::error::Result;
use crate::models::{
    Create, Delete, List, Project, Retrieve, ScenarioWithCountTrains, ScenarioWithDetails, Study,
    Timetable, Update,
};
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::views::projects::ProjectError;
use crate::views::study::StudyError;
use crate::{models::Scenario, DbPool};
use actix_web::{delete, HttpResponse};

use actix_web::get;
use actix_web::patch;
use actix_web::web::Query;
use actix_web::{
    dev::HttpServiceFactory,
    post,
    web::{self, Data, Json, Path},
};
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Returns `/projects/{project}/studies/{study}/scenarios` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/scenarios")
        .service((create, list))
        .service(web::scope("/{scenario}").service((get, delete, patch)))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "scenario")]
#[allow(clippy::enum_variant_names)]
enum ScenarioError {
    /// Couldn't found the scenario with the given scenario ID

    #[error("Scenario '{scenario_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { scenario_id: i64 },
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra: i64,
    pub electrical_profile_set: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ScenarioCreateForm {
    pub fn into_scenario(self, study_id: i64, timetable_id: i64) -> Scenario {
        Scenario {
            name: Some(self.name),
            study_id: Some(study_id),
            infra_id: Some(self.infra),
            electrical_profile_set_id: Some(self.electrical_profile_set),
            timetable_id: Some(timetable_id),
            description: Some(self.description),
            tags: Some(self.tags),
            creation_date: Some(Utc::now().naive_utc()),
            ..Default::default()
        }
    }
}

/// Check if project and study exist given a study ID and a project ID
async fn check_project_study(
    db_pool: Data<DbPool>,
    project_id: i64,
    study_id: i64,
) -> Result<(Project, Study)> {
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        None => return Err(ProjectError::NotFound { project_id }.into()),
        Some(project) => project,
    };
    let study = match Study::retrieve(db_pool.clone(), study_id).await? {
        None => return Err(StudyError::NotFound { study_id }.into()),
        Some(study) => study,
    };
    Ok((project, study))
}

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<ScenarioCreateForm>,
    path: Path<(i64, i64)>,
) -> Result<Json<ScenarioWithDetails>> {
    let (project_id, study_id) = path.into_inner();

    // Check if the project and the study exist
    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id).await?;

    // Create timetable
    let timetable = Timetable {
        id: None,
        name: Some("timetable".into()),
    };
    let timetable = timetable.create(db_pool.clone()).await?;
    let timetable_id = timetable.id.unwrap();

    // Create Scenario
    let scenario: Scenario = data.into_inner().into_scenario(study_id, timetable_id);
    let scenario = scenario.create(db_pool.clone()).await?;

    // Update study last_modification field
    let study = study.update_last_modified(db_pool.clone()).await?;
    study.expect("Study should exist");

    // Update project last_modification field
    let project = project.update_last_modified(db_pool.clone()).await?;
    project.expect("Project should exist");

    // Return study with list of scenarios
    let scenarios_with_trains = scenario.with_details(db_pool).await?;

    Ok(Json(scenarios_with_trains))
}

/// Delete a scenario
#[delete("")]
async fn delete(path: Path<(i64, i64, i64)>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let (project_id, study_id, scenario_id) = path.into_inner();

    // Check if the project and the study exist
    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id)
        .await
        .unwrap();

    // Delete scenario
    if !Scenario::delete(db_pool.clone(), scenario_id).await? {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    // Update project last_modification field
    let project = project.update_last_modified(db_pool.clone()).await?;
    project.expect("Project should exist");

    // Update study last_modification field
    let study = study.update_last_modified(db_pool).await?;
    study.expect("Study should exist");

    Ok(HttpResponse::NoContent().finish())
}

/// This structure is used by the patch endpoint to patch a study
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
struct ScenarioPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub electrical_profile_set_id: Option<Option<i64>>,
    pub tags: Option<Vec<String>>,
}

impl From<ScenarioPatchForm> for Scenario {
    fn from(form: ScenarioPatchForm) -> Self {
        Scenario {
            name: form.name,
            description: form.description,
            electrical_profile_set_id: form.electrical_profile_set_id,
            tags: form.tags,
            ..Default::default()
        }
    }
}

#[patch("")]
async fn patch(
    data: Json<ScenarioPatchForm>,
    path: Path<(i64, i64, i64)>,
    db_pool: Data<DbPool>,
) -> Result<Json<ScenarioWithDetails>> {
    let (project_id, study_id, scenario_id) = path.into_inner();

    // Check if project and study exist
    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id)
        .await
        .unwrap();
    // Update a scenario
    let scenario: Scenario = data.into_inner().into();
    let scenario = match scenario.update(db_pool.clone(), scenario_id).await? {
        Some(scenario) => scenario,
        None => return Err(ScenarioError::NotFound { scenario_id }.into()),
    };

    // Update study last_modification field
    let study = study.update_last_modified(db_pool.clone()).await?;
    study.expect("Study should exist");

    // Update project last_modification field
    let project = project.update_last_modified(db_pool.clone()).await?;
    project.expect("Project should exist");

    let scenarios_with_details = scenario.with_details(db_pool).await?;
    Ok(Json(scenarios_with_details))
}

#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    path: Path<(i64, i64, i64)>,
) -> Result<Json<ScenarioWithDetails>> {
    let (project_id, study_id, scenario_id) = path.into_inner();

    let _ = check_project_study(db_pool.clone(), project_id, study_id).await?;

    // Return the scenarios
    let scenario = match Scenario::retrieve(db_pool.clone(), scenario_id).await? {
        Some(study) => study,
        None => return Err(ScenarioError::NotFound { scenario_id }.into()),
    };
    let scenario_with_trains = scenario.with_details(db_pool).await?;
    Ok(Json(scenario_with_trains))
}

/// Return a list of studies
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
    path: Path<(i64, i64)>,
) -> Result<Json<PaginatedResponse<ScenarioWithCountTrains>>> {
    let (project_id, study_id) = path.into_inner();
    let _ = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let scenarios = ScenarioWithCountTrains::list(db_pool, page, per_page, study_id).await?;

    Ok(Json(scenarios))
}

#[cfg(test)]
mod test {
    use crate::infra::Infra;
    use crate::models::Project;
    use crate::models::Scenario;
    use crate::models::Study;
    use crate::views::infra::tests::{create_infra_request, delete_infra_request};
    use crate::views::projects::test::{create_project_request, delete_project_request};
    use crate::views::study::test::create_study_request;

    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use serde_json::json;

    pub async fn create_scenario_request() -> (Request, i64) {
        let app = create_test_service().await;
        let response = call_service(&app, create_project_request()).await;
        let project: Project = read_body_json(response).await;
        let response = call_service(&app, create_study_request().await).await;
        let study: Study = read_body_json(response).await;
        let response = call_service(&app, create_infra_request("infra_test")).await;
        let infra: Infra = read_body_json(response).await;
        let project_id = project.id.unwrap();
        let study_id = study.id.unwrap();

        (
            TestRequest::post()
                .uri(format!("/projects/{project_id}/studies/{study_id}/scenarios").as_str())
                .set_json(json!({ "name": "scenario_test" ,"infra": infra.id }))
                .to_request(),
            project_id,
        )
    }

    pub fn delete_scenario_request(project_id: i64, study_id: i64, scenario_id: i64) -> Request {
        let url = format!("/projects/{project_id}/studies/{study_id}/scenarios/{scenario_id}");
        TestRequest::delete().uri(url.as_str()).to_request()
    }

    #[actix_test]
    async fn scenario_create_delete() {
        let app = create_test_service().await;
        let (request, project_id) = create_scenario_request().await;
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);
        let scenario: Scenario = read_body_json(response).await;
        assert_eq!(scenario.name.unwrap(), "scenario_test");
        let response = call_service(
            &app,
            delete_scenario_request(project_id, scenario.study_id.unwrap(), scenario.id.unwrap()),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_project_request(project_id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_infra_request(scenario.infra_id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn scenario_list() {
        let app = create_test_service().await;
        let (request, project_id) = create_scenario_request().await;
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);
        let scenario: Scenario = read_body_json(response).await;
        let study_id = scenario.study_id.unwrap();
        let url = format!("/projects/{project_id}/studies/{study_id}/scenarios/");
        let req = TestRequest::get().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let response = call_service(&app, delete_project_request(project_id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn scenario_get() {
        let app = create_test_service().await;
        let (request, project_id) = create_scenario_request().await;
        let scenario: Scenario = call_and_read_body_json(&app, request).await;
        let study_id = scenario.study_id.unwrap();
        let scenario_id = scenario.id.unwrap();
        let url = format!("/projects/{project_id}/studies/{study_id}/scenarios/{scenario_id}");
        let req = TestRequest::get().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let req = TestRequest::delete().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(
            &app,
            delete_scenario_request(project_id, study_id, scenario_id),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let response = call_service(&app, delete_project_request(project_id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn scenario_patch() {
        let app = create_test_service().await;
        let (request, project_id) = create_scenario_request().await;
        let scenario: Scenario = call_and_read_body_json(&app, request).await;
        let study_id = scenario.study_id.unwrap();
        let scenario_id = scenario.id.unwrap();
        let url = format!("/projects/{project_id}/studies/{study_id}/scenarios/{scenario_id}");
        let req = TestRequest::patch()
            .uri(url.as_str())
            .set_json(json!({"name": "rename_test"}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let response = call_service(&app, delete_project_request(project_id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
