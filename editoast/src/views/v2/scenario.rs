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

use crate::error::InternalError;
use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::modelsv2::prelude::*;
use crate::modelsv2::scenario::Scenario;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPoolV2;
use crate::modelsv2::Infra;
use crate::modelsv2::Project;
use crate::modelsv2::Study;
use crate::modelsv2::Tags;
use crate::views::operational_studies::OperationalStudiesOrderingParam;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;
use crate::views::projects::ProjectError;
use crate::views::projects::ProjectIdParam;
use crate::views::scenario::ScenarioIdParam;
use crate::views::study::StudyError;
use crate::views::study::StudyIdParam;

crate::routes! {
    "/v2/projects/{project_id}/studies/{study_id}/scenarios" => {
        create,
        list,
        "/{scenario_id}" => {
            get,
            delete,
            patch,
        }
    }
}

editoast_common::schemas! {
    ScenarioPatchForm,
    Scenario,
    ScenarioWithDetails,
    ScenarioResponse,
    ScenarioCreateForm,
    LightTrainSchedule, // TODO: remove from here once train schedule is migrated
}

#[derive(IntoParams, Deserialize)]
struct ScenarioPathParam {
    project_id: i64,
    study_id: i64,
    scenario_id: i64,
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[schema(as = ScenarioCreateFormV2)]
#[derivative(Default)]
struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra_id: i64,
    pub timetable_id: i64,
    #[serde(default)]
    pub tags: Tags,
}

impl From<ScenarioCreateForm> for Changeset<Scenario> {
    fn from(scenario: ScenarioCreateForm) -> Self {
        Scenario::changeset()
            .name(scenario.name)
            .description(scenario.description)
            .creation_date(Utc::now().naive_utc())
            .last_modification(Utc::now().naive_utc())
            .infra_id(scenario.infra_id)
            .timetable_id(scenario.timetable_id)
            .tags(scenario.tags)
    }
}

pub async fn check_project_study(
    conn: &mut DbConnection,
    project_id: i64,
    study_id: i64,
) -> Result<(Project, Study)> {
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
    let study =
        Study::retrieve_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    if study.project_id != project_id {
        return Err(StudyError::NotFound { study_id }.into());
    }
    Ok((project, study))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "scenario")]
#[allow(clippy::enum_variant_names)]
pub enum ScenarioError {
    /// Couldn't found the scenario with the given scenario ID

    #[error("Scenario '{scenario_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { scenario_id: i64 },

    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },

    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[schema(as = ScenarioWithDetailsV2)]
pub struct ScenarioWithDetails {
    #[serde(flatten)]
    #[schema(value_type = ScenarioV2)]
    pub scenario: Scenario,
    pub infra_name: String,
    pub trains_count: i64,
}

impl ScenarioWithDetails {
    pub async fn from_scenario(scenario: Scenario, conn: &mut DbConnection) -> Result<Self> {
        Ok(Self {
            infra_name: scenario.infra_name(conn).await?,
            trains_count: scenario.trains_count(conn).await?,
            scenario,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[schema(as = ScenarioResponseV2)]
pub struct ScenarioResponse {
    #[serde(flatten)]
    #[schema(value_type = ScenarioV2)]
    pub scenario: Scenario,
    pub infra_name: String,
    pub trains_count: i64,
    pub project: Project,
    pub study: Study,
}

impl ScenarioResponse {
    pub fn new(
        scenarios_with_details: ScenarioWithDetails,
        project: Project,
        study: Study,
    ) -> Self {
        Self {
            scenario: scenarios_with_details.scenario,
            infra_name: scenarios_with_details.infra_name,
            trains_count: scenarios_with_details.trains_count,
            project,
            study,
        }
    }
}

/// Create a scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam),
    request_body = ScenarioCreateFormV2,
    responses(
        (status = 201, body = ScenarioResponseV2, description = "The created scenario"),
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbConnectionPoolV2>,
    data: Json<ScenarioCreateForm>,
    path: Path<(i64, i64)>,
) -> Result<Json<ScenarioResponse>> {
    let (project_id, study_id) = path.into_inner();
    let timetable_id = data.timetable_id;
    let infra_id = data.infra_id;
    let scenario: Changeset<Scenario> = data.into_inner().into();

    let scenarios_response = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if the project and the study exist
                let (mut project, study) = check_project_study(conn, project_id, study_id).await?;

                // Check if the timetable exists
                let _ = Timetable::retrieve_or_fail(conn, timetable_id, || {
                    ScenarioError::TimetableNotFound { timetable_id }
                })
                .await?;

                // Check if the infra exists
                if !Infra::exists(conn, infra_id).await? {
                    return Err(ScenarioError::InfraNotFound { infra_id }.into());
                }

                // Create Scenario
                let scenario = scenario.study_id(study_id).create(conn).await?;

                // Update study last_modification field
                study.clone().update_last_modified(conn).await?;

                // Update project last_modification field
                project.update_last_modified(conn).await?;

                let scenarios_with_details =
                    ScenarioWithDetails::from_scenario(scenario, conn).await?;

                let scenarios_response =
                    ScenarioResponse::new(scenarios_with_details, project, study);

                Ok(scenarios_response)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(scenarios_response))
}

/// Delete a scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 204, description = "The scenario was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
#[delete("")]
async fn delete(
    path: Path<ScenarioPathParam>,
    db_pool: Data<DbConnectionPoolV2>,
) -> Result<HttpResponse> {
    let ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    } = path.into_inner();

    db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if the project and the study exist
                let (mut project, study) = check_project_study(conn, project_id, study_id)
                    .await
                    .unwrap();

                // Delete scenario
                Scenario::delete_static_or_fail(conn, scenario_id, || ScenarioError::NotFound {
                    scenario_id,
                })
                .await?;

                // Update project last_modification field
                project.update_last_modified(conn).await?;

                // Update study last_modification field
                study.clone().update_last_modified(conn).await?;

                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(HttpResponse::NoContent().finish())
}

/// This structure is used by the patch endpoint to patch a scenario
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[schema(as = ScenarioPatchFormV2)]
#[derivative(Default)]
struct ScenarioPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Tags>,
    pub infra_id: Option<i64>,
}

impl From<ScenarioPatchForm> for <Scenario as crate::modelsv2::Model>::Changeset {
    fn from(scenario: ScenarioPatchForm) -> Self {
        Scenario::changeset()
            .flat_name(scenario.name)
            .flat_description(scenario.description)
            .flat_tags(scenario.tags)
            .flat_infra_id(scenario.infra_id)
            .last_modification(Utc::now().naive_utc())
    }
}

/// Update a scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    request_body = ScenarioPatchFormV2,
    responses(
        (status = 204, body = ScenarioResponseV2, description = "The scenario was updated successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
#[patch("")]
async fn patch(
    data: Json<ScenarioPatchForm>,
    path: Path<ScenarioPathParam>,
    db_pool: Data<DbConnectionPoolV2>,
) -> Result<Json<ScenarioResponse>> {
    let ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    } = path.into_inner();

    let scenarios_response = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project and study exist
                let (mut project, study) = check_project_study(conn, project_id, study_id).await?;

                // Check if the infra exists
                if let Some(infra_id) = data.0.infra_id {
                    if !Infra::exists(conn, infra_id).await? {
                        return Err(ScenarioError::InfraNotFound { infra_id }.into());
                    }
                }

                // Update the scenario
                let scenario: Changeset<Scenario> = data.into_inner().into();
                let scenario = scenario
                    .update_or_fail(conn, scenario_id, || ScenarioError::NotFound {
                        scenario_id,
                    })
                    .await?;

                // Update study last_modification field
                study.clone().update_last_modified(conn).await?;

                // Update project last_modification field
                project.update_last_modified(conn).await?;

                let scenario_with_details =
                    ScenarioWithDetails::from_scenario(scenario, conn).await?;

                let scenarios_response =
                    ScenarioResponse::new(scenario_with_details, project, study);

                Ok(scenarios_response)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(scenarios_response))
}

/// Return a specific scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 200, body = ScenarioResponseV2, description = "The requested scenario"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<ScenarioPathParam>,
) -> Result<Json<ScenarioResponse>> {
    let ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    } = path.into_inner();

    let conn = &mut db_pool.get().await?;

    let (project, study) = check_project_study(conn, project_id, study_id).await?;
    // Return the scenarios
    let scenario = Scenario::retrieve_or_fail(conn, scenario_id, || ScenarioError::NotFound {
        scenario_id,
    })
    .await?;

    // Check if the scenario belongs to the study
    if scenario.study_id != study_id {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    let scenarios_with_details = ScenarioWithDetails::from_scenario(scenario, conn).await?;
    let scenarios_response = ScenarioResponse::new(scenarios_with_details, project, study);
    Ok(Json(scenarios_response))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct ListScenariosResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<ScenarioWithDetails>,
}

/// Return a list of scenarios
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, PaginationQueryParam, OperationalStudiesOrderingParam),
    responses(
        (status = 200, description = "A paginated list of scenarios", body = inline(ListScenariosResponse)),
        (status = 404, description = "Project or study doesn't exist")
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<(i64, i64)>,
    Query(pagination_params): Query<PaginationQueryParam>,
    Query(OperationalStudiesOrderingParam { ordering }): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ListScenariosResponse>> {
    let (project_id, study_id) = path.into_inner();
    let _ = check_project_study(db_pool.get().await?.deref_mut(), project_id, study_id).await?;

    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings()
        .order_by(move || ordering.as_scenario_ordering())
        .filter(move || Scenario::STUDY_ID.eq(study_id));
    let (scenarios, stats) =
        Scenario::list_paginated(db_pool.get().await?.deref_mut(), settings).await?;

    let futs = scenarios
        .into_iter()
        .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
        .map(|(scenario, conn)| async {
            ScenarioWithDetails::from_scenario(scenario, conn.await?.deref_mut()).await
        });
    let results = futures::future::try_join_all(futs).await?;

    Ok(Json(ListScenariosResponse { stats, results }))
}

#[cfg(test)]
mod tests {
    use actix_web::http::StatusCode;
    use actix_web::test::TestRequest;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::fixtures::create_project;
    use crate::modelsv2::fixtures::create_scenario_fixtures_set;
    use crate::modelsv2::fixtures::create_study;
    use crate::modelsv2::fixtures::create_timetable;
    use crate::views::test_app::TestAppBuilder;

    pub fn scenario_url(project_id: i64, study_id: i64, scenario_id: Option<i64>) -> String {
        format!(
            "/v2/projects/{}/studies/{}/scenarios/{}",
            project_id,
            study_id,
            scenario_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    #[rstest]
    async fn get_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );
        let request = TestRequest::get().uri(&url).to_request();

        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario, fixtures.scenario);
    }

    #[rstest]
    async fn get_scenarios() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;

        let url = scenario_url(fixtures.project.id, fixtures.study.id, None);
        let request = TestRequest::get().uri(&url).to_request();

        let mut response: ListScenariosResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(!response.results.is_empty());
        assert_eq!(
            response
                .results
                .pop()
                .expect("a fixture scenario should exist")
                .infra_name,
            fixtures.infra.name
        );
    }

    #[rstest]
    async fn get_scenarios_with_wrong_study() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;

        let url = scenario_url(fixtures.project.id, 99999999, Some(fixtures.scenario.id));

        let request = TestRequest::get().uri(&url).to_request();

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn post_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let project = create_project(pool.get_ok().deref_mut(), "project_test_name").await;
        let study = create_study(pool.get_ok().deref_mut(), "study_test_name", project.id).await;
        let infra = create_empty_infra(pool.get_ok().deref_mut()).await;
        let timetable = create_timetable(pool.get_ok().deref_mut()).await;

        let url = scenario_url(project.id, study.id, None);

        let study_name = "new created scenario";
        let study_description = "new created scenario description";
        let study_timetable_id = timetable.id;
        let study_infra_id = infra.id;
        let study_tags = Tags::new(vec!["tag1".to_string(), "tag2".to_string()]);

        // Insert scenario
        let request = TestRequest::post()
            .uri(&url)
            .set_json(json!({
                "name": study_name,
                "description": study_description,
                "infra_id": study_infra_id,
                "timetable_id": study_timetable_id,
                "tags": study_tags
            }))
            .to_request();

        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario.name, study_name);
        assert_eq!(response.scenario.description, study_description);
        assert_eq!(response.scenario.infra_id, study_infra_id);
        assert_eq!(response.scenario.timetable_id, study_timetable_id);
        assert_eq!(response.scenario.tags, study_tags);

        let created_scenario = Scenario::retrieve(pool.get_ok().deref_mut(), response.scenario.id)
            .await
            .expect("Failed to retrieve scenario")
            .expect("Scenario not found");

        assert_eq!(created_scenario.name, study_name);
        assert_eq!(created_scenario.description, study_description);
        assert_eq!(created_scenario.infra_id, study_infra_id);
        assert_eq!(created_scenario.timetable_id, study_timetable_id);
        assert_eq!(created_scenario.tags, study_tags);
    }

    #[rstest]
    async fn patch_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );

        let study_name = "new patched scenario";
        let study_description = "new patched scenario description";
        let study_tags = Tags::new(vec!["patched_tag1".to_string(), "patched_tag2".to_string()]);

        // Update scenario
        let request = TestRequest::patch()
            .uri(&url)
            .set_json(json!({
                "name": study_name,
                "description": study_description,
                "tags": study_tags
            }))
            .to_request();
        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario.name, study_name);
        assert_eq!(response.scenario.description, study_description);
        assert_eq!(response.scenario.tags, study_tags);
        assert!(response.scenario.last_modification > fixtures.scenario.last_modification);
    }

    #[rstest]
    async fn patch_scenario_with_unavailable_infra() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );

        // Update scenario
        let request = TestRequest::patch()
            .uri(&url)
            .set_json(json!({
                "infra_id": 999999999,
            }))
            .to_request();

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn patch_infra_id_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;
        let other_infra = create_empty_infra(pool.get_ok().deref_mut()).await;

        assert_eq!(fixtures.scenario.infra_id, fixtures.infra.id);
        assert_ne!(fixtures.scenario.infra_id, other_infra.id);

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );

        let study_name = "new patched scenario V2";
        let study_other_infra_id = other_infra.id;

        let request = TestRequest::patch()
            .uri(&url)
            .set_json(json!({
                "name": study_name,
                "infra_id": study_other_infra_id,
            }))
            .to_request();
        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario.infra_id, study_other_infra_id);
        assert_eq!(response.scenario.name, study_name);
    }

    #[rstest]
    async fn delete_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(pool.get_ok().deref_mut(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );
        let request = TestRequest::delete().uri(&url).to_request();

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Scenario::exists(pool.get_ok().deref_mut(), fixtures.scenario.id)
            .await
            .expect("Failed to check if scenario exists");

        assert!(!exists);
    }
}
