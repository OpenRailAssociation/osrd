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

use crate::decl_paginated_response;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::models::List;
use crate::modelsv2::prelude::*;
use crate::modelsv2::scenario::Scenario;
use crate::modelsv2::scenario::ScenarioWithDetails;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::Infra;
use crate::modelsv2::Project;
use crate::modelsv2::Study;
use crate::modelsv2::Tags;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::views::projects::ProjectIdParam;
use crate::views::projects::QueryParams;
use crate::views::scenario::check_project_study;
use crate::views::scenario::check_project_study_conn;
use crate::views::scenario::ScenarioIdParam;
use crate::views::study::StudyIdParam;
use crate::DbPool;

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
    PaginatedResponseOfScenarioWithDetails,
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
    db_pool: Data<DbPool>,
    data: Json<ScenarioCreateForm>,
    path: Path<(i64, i64)>,
) -> Result<Json<ScenarioResponse>> {
    let (project_id, study_id) = path.into_inner();
    let timetable_id = data.timetable_id;
    let infra_id = data.infra_id;
    let scenario: Changeset<Scenario> = data.into_inner().into();

    let mut tx = db_pool.get().await?;

    let scenarios_response = tx
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if the project and the study exist
                let (mut project, study) =
                    check_project_study_conn(conn, project_id, study_id).await?;

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
async fn delete(path: Path<ScenarioPathParam>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    } = path.into_inner();
    let mut tx = db_pool.get().await?;

    tx.transaction::<_, InternalError, _>(|conn| {
        async {
            // Check if the project and the study exist
            let (mut project, study) = check_project_study(db_pool.clone(), project_id, study_id)
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
    db_pool: Data<DbPool>,
) -> Result<Json<ScenarioResponse>> {
    let ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    } = path.into_inner();

    let mut tx = db_pool.get().await?;

    let scenarios_response = tx
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project and study exist
                let (mut project, study) =
                    check_project_study_conn(conn, project_id, study_id).await?;

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
    db_pool: Data<DbPool>,
    path: Path<ScenarioPathParam>,
) -> Result<Json<ScenarioResponse>> {
    use crate::modelsv2::Retrieve;

    let ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    } = path.into_inner();

    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let conn = &mut db_pool.get().await?;
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

type ScenarioWithDetailsV2 = ScenarioWithDetails;
decl_paginated_response!(
    PaginatedResponseOfScenarioWithDetails,
    ScenarioWithDetailsV2
);

/// Return a list of scenarios
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, PaginationQueryParam, QueryParams),
    responses(
        (status = 200, body = PaginatedResponseOfScenarioWithDetails, description = "The list of scenarios"),
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
    path: Path<(i64, i64)>,
    params: Query<QueryParams>,
) -> Result<Json<PaginatedResponse<ScenarioWithDetails>>> {
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let (project_id, study_id) = path.into_inner();

    let _ = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let ordering = params.ordering.clone();
    let scenarios =
        ScenarioWithDetails::list(db_pool.clone(), page, per_page, (study_id, ordering)).await?;
    Ok(Json(scenarios))
}

#[cfg(test)]
mod tests {
    use actix_web::http::StatusCode;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::scenario_v2_fixture_set;
    use crate::fixtures::tests::small_infra;
    use crate::fixtures::tests::timetable_v2;
    use crate::fixtures::tests::ScenarioV2FixtureSet;
    use crate::fixtures::tests::TestFixture;
    use crate::modelsv2::timetable::Timetable as TimetableV2;
    use crate::modelsv2::Infra;
    use crate::views::tests::create_test_service;

    pub fn scenario_url(project_id: i64, study_id: i64, scenario_id: Option<i64>) -> String {
        format!(
            "/v2/projects/{}/studies/{}/scenarios/{}",
            project_id,
            study_id,
            scenario_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    #[rstest]
    async fn get_scenario(#[future] scenario_v2_fixture_set: ScenarioV2FixtureSet) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;

        let url = scenario_url(
            fixtures.project.id(),
            fixtures.study.id(),
            Some(fixtures.scenario.id()),
        );

        let request = TestRequest::get().uri(&url).to_request();
        let response: ScenarioResponse = call_and_read_body_json(&service, request).await;

        assert_eq!(response.scenario.id, fixtures.scenario.id());
        assert_eq!(response.scenario.name, fixtures.scenario.model.name);
    }

    #[rstest]
    async fn get_scenarios(#[future] scenario_v2_fixture_set: ScenarioV2FixtureSet) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;

        let url = scenario_url(fixtures.project.id(), fixtures.study.id(), None);

        let request = TestRequest::get().uri(&url).to_request();
        let mut response: PaginatedResponse<ScenarioWithDetails> =
            call_and_read_body_json(&service, request).await;

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
    async fn get_scenarios_with_wrong_study(
        #[future] scenario_v2_fixture_set: ScenarioV2FixtureSet,
    ) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;

        let url = scenario_url(
            fixtures.project.id(),
            99999999,
            Some(fixtures.scenario.id()),
        );

        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn post_scenario(
        #[future] scenario_v2_fixture_set: ScenarioV2FixtureSet,
        #[future] timetable_v2: TestFixture<TimetableV2>,
        db_pool: Data<DbPool>,
    ) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;
        let timetable_v2 = timetable_v2.await;

        let url = scenario_url(fixtures.project.id(), fixtures.study.id(), None);

        let study_name = "new created scenario V2";
        let study_description = "new created scenario description V2";
        let study_timetable_id = timetable_v2.id();
        let study_infra_id = fixtures.infra.id();
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
        let response: ScenarioResponse = call_and_read_body_json(&service, request).await;

        // Delete the scenario
        assert!(
            Scenario::delete_static(&mut db_pool.get().await.unwrap(), response.scenario.id)
                .await
                .unwrap()
        );

        assert_eq!(response.scenario.name, study_name);
        assert_eq!(response.scenario.description, study_description);
        assert_eq!(response.scenario.infra_id, study_infra_id);
        assert_eq!(response.scenario.timetable_id, study_timetable_id);
        assert_eq!(response.scenario.tags, study_tags);
    }

    #[rstest]
    async fn patch_scenario(#[future] scenario_v2_fixture_set: ScenarioV2FixtureSet) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;

        let url = scenario_url(
            fixtures.project.id(),
            fixtures.study.id(),
            Some(fixtures.scenario.id()),
        );

        let study_name = "new patched scenario V2";
        let study_description = "new patched scenario description V2";
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
        let response: ScenarioResponse = call_and_read_body_json(&service, request).await;

        assert_eq!(response.scenario.name, study_name);
        assert_eq!(response.scenario.description, study_description);
        assert_eq!(response.scenario.tags, study_tags);
    }

    #[rstest]
    async fn patch_scenario_with_unavailable_infra(
        #[future] scenario_v2_fixture_set: ScenarioV2FixtureSet,
    ) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;

        let url = scenario_url(
            fixtures.project.id(),
            fixtures.study.id(),
            Some(fixtures.scenario.id()),
        );

        // Update scenario
        let request = TestRequest::patch()
            .uri(&url)
            .set_json(json!({
                "infra_id": 999999999,
            }))
            .to_request();
        let response = call_service(&service, request).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn patch_infra_id_scenario(
        #[future] scenario_v2_fixture_set: ScenarioV2FixtureSet,
        #[future] small_infra: TestFixture<Infra>,
    ) {
        let service = create_test_service().await;
        let small_infra = small_infra.await;
        let fixtures = scenario_v2_fixture_set.await;

        assert_eq!(fixtures.scenario.model.infra_id, fixtures.infra.id());

        let url = scenario_url(
            fixtures.project.id(),
            fixtures.study.id(),
            Some(fixtures.scenario.id()),
        );

        let study_name = "new patched scenario V2";
        let study_small_infra_infra_id = small_infra.id();

        let request = TestRequest::patch()
            .uri(&url)
            .set_json(json!({
                "name": study_name,
                "infra_id": study_small_infra_infra_id,
            }))
            .to_request();
        let response: ScenarioResponse = call_and_read_body_json(&service, request).await;

        assert_eq!(response.scenario.infra_id, study_small_infra_infra_id);
        assert_eq!(response.scenario.name, study_name);
    }

    #[rstest]
    async fn delete_scenario(#[future] scenario_v2_fixture_set: ScenarioV2FixtureSet) {
        let service = create_test_service().await;
        let fixtures = scenario_v2_fixture_set.await;

        let url = scenario_url(
            fixtures.project.id(),
            fixtures.study.id(),
            Some(fixtures.scenario.id()),
        );
        let request = TestRequest::delete().uri(&url).to_request();
        let response = call_service(&service, request).await;

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
