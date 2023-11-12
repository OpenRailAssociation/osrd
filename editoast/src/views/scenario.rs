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

use super::projects::QueryParams;

/// Returns `/projects/{project}/studies/{study}/scenarios` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/projects/{project_id}/studies/{study_id}/scenarios")
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
    pub infra_id: i64,
    pub electrical_profile_set_id: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ScenarioCreateForm {
    pub fn into_scenario(self, study_id: i64, timetable_id: i64) -> Scenario {
        Scenario {
            name: Some(self.name),
            study_id: Some(study_id),
            infra_id: Some(self.infra_id),
            electrical_profile_set_id: Some(self.electrical_profile_set_id),
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

    if study.project_id.unwrap() != project_id {
        return Err(StudyError::NotFound { study_id }.into());
    }
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
    pub tags: Option<Vec<String>>,
}

impl From<ScenarioPatchForm> for Scenario {
    fn from(form: ScenarioPatchForm) -> Self {
        Scenario {
            name: form.name,
            description: form.description,
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
        Some(scenario) => scenario,
        None => return Err(ScenarioError::NotFound { scenario_id }.into()),
    };

    // Check if the scenario belongs to the study
    if scenario.study_id.unwrap() != study_id {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    let scenario_with_trains = scenario.with_details(db_pool).await?;
    Ok(Json(scenario_with_trains))
}

/// Return a list of studies
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
    path: Path<(i64, i64)>,
    params: Query<QueryParams>,
) -> Result<Json<PaginatedResponse<ScenarioWithCountTrains>>> {
    let (project_id, study_id) = path.into_inner();
    let _ = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let ordering = params.ordering.clone();
    let scenarios =
        ScenarioWithCountTrains::list(db_pool, page, per_page, (study_id, ordering)).await?;

    Ok(Json(scenarios))
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::fixtures::tests::{
        db_pool, empty_infra, scenario_fixture_set, study_fixture_set, ScenarioFixtureSet,
        StudyFixtureSet, TestFixture,
    };

    use crate::models::Infra;
    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    pub fn easy_scenario_url(scenario_fixture_set: &ScenarioFixtureSet, detail: bool) -> String {
        scenario_url(
            scenario_fixture_set.project.id(),
            scenario_fixture_set.study.id(),
            detail.then_some(scenario_fixture_set.scenario.id()),
        )
    }

    pub fn scenario_url(project_id: i64, study_id: i64, scenario_id: Option<i64>) -> String {
        format!(
            "/projects/{}/studies/{}/scenarios/{}",
            project_id,
            study_id,
            scenario_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    fn delete_scenario_request(scenario_fixture_set: &ScenarioFixtureSet) -> Request {
        let url = easy_scenario_url(scenario_fixture_set, true);
        TestRequest::delete().uri(url.as_str()).to_request()
    }

    #[rstest]
    async fn scenario_create(
        db_pool: Data<DbPool>,
        #[future] study_fixture_set: StudyFixtureSet,
        #[future] empty_infra: TestFixture<Infra>,
    ) {
        let app = create_test_service().await;
        let StudyFixtureSet { study, project } = study_fixture_set.await;
        let empty_infra = empty_infra.await;

        let request = TestRequest::post()
            .uri(scenario_url(project.id(), study.id(), None).as_str())
            .set_json(json!({ "name": "scenario_test" ,"infra_id": empty_infra.id() }))
            .to_request();
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);

        let scenario = TestFixture::<Scenario>::new(read_body_json(response).await, db_pool);
        assert_eq!(scenario.model.name.clone().unwrap(), "scenario_test");
    }

    #[rstest]
    async fn scenario_delete() {
        let app = create_test_service().await;
        let scenario_fixture_set = scenario_fixture_set().await;

        let response = call_service(&app, delete_scenario_request(&scenario_fixture_set)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_scenario_request(&scenario_fixture_set)).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn scenario_list() {
        let app = create_test_service().await;
        let scenario_fixture_set = scenario_fixture_set().await;

        let url = easy_scenario_url(&scenario_fixture_set, false);
        let req = TestRequest::get().uri(url.as_str()).to_request();
        let response = call_service(&app, req).await;

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn scenario_get() {
        let app = create_test_service().await;
        let scenario_fixture_set = scenario_fixture_set().await;

        let url = easy_scenario_url(&scenario_fixture_set, true);
        let url_project_not_found = scenario_url(
            scenario_fixture_set.project.id() + 1,
            scenario_fixture_set.study.id(),
            Some(scenario_fixture_set.scenario.id()),
        );
        let url_study_not_found = scenario_url(
            scenario_fixture_set.project.id(),
            scenario_fixture_set.study.id() + 1,
            Some(scenario_fixture_set.scenario.id()),
        );
        let response = call_service(
            &app,
            TestRequest::get()
                .uri(url_project_not_found.as_str())
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let response = call_service(
            &app,
            TestRequest::get()
                .uri(url_study_not_found.as_str())
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let response = call_service(&app, TestRequest::get().uri(url.as_str()).to_request()).await;
        assert_eq!(response.status(), StatusCode::OK);
        let response =
            call_service(&app, TestRequest::delete().uri(url.as_str()).to_request()).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let response = call_service(&app, TestRequest::get().uri(url.as_str()).to_request()).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn scenario_patch() {
        let app = create_test_service().await;
        let scenario_fixture_set = scenario_fixture_set().await;

        let url = easy_scenario_url(&scenario_fixture_set, true);
        let new_name = scenario_fixture_set.scenario.model.name.clone().unwrap() + "_patched";
        let req = TestRequest::patch()
            .uri(url.as_str())
            .set_json(json!({ "name": new_name }))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let scenario: ScenarioWithDetails = read_body_json(response).await;
        assert_eq!(scenario.scenario.name.unwrap(), new_name);
    }
}
