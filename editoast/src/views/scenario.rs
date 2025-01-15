pub mod macro_nodes;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
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

use crate::error::InternalError;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::scenario::Scenario;
use crate::models::timetable::Timetable;
use crate::models::Infra;
use crate::models::Project;
use crate::models::Study;
use crate::models::Tags;
use crate::views::operational_studies::OperationalStudiesOrderingParam;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::projects::ProjectError;
use crate::views::projects::ProjectIdParam;
use crate::views::study::StudyError;
use crate::views::study::StudyIdParam;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;

crate::routes! {
    "/projects/{project_id}/studies/{study_id}/scenarios" => {
        create,
        list,
        "/{scenario_id}" => {
            get,
            delete,
            patch,
            &macro_nodes,
        },
    },
}

editoast_common::schemas! {
    ScenarioPatchForm,
    Scenario,
    ScenarioWithDetails,
    ScenarioResponse,
    ScenarioCreateForm,
}

#[derive(IntoParams, Deserialize)]
struct ScenarioPathParam {
    project_id: i64,
    study_id: i64,
    scenario_id: i64,
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct ScenarioIdParam {
    scenario_id: i64,
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra_id: i64,
    pub timetable_id: i64,
    #[serde(default)]
    pub tags: Tags,
    pub electrical_profile_set_id: Option<i64>,
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
            .electrical_profile_set_id(scenario.electrical_profile_set_id)
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
pub struct ScenarioWithDetails {
    #[serde(flatten)]
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
pub struct ScenarioResponse {
    #[serde(flatten)]
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
    post, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam),
    request_body = ScenarioCreateForm,
    responses(
        (status = 201, body = ScenarioResponse, description = "The created scenario"),
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
    Json(data): Json<ScenarioCreateForm>,
) -> Result<Json<ScenarioResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let timetable_id = data.timetable_id;
    let infra_id = data.infra_id;
    let scenario: Changeset<Scenario> = data.into();

    let scenarios_response = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                // Check if the project and the study exist
                let (mut project, study) =
                    check_project_study(&mut conn.clone(), project_id, study_id).await?;

                // Check if the timetable exists
                let _ = Timetable::retrieve_or_fail(&mut conn.clone(), timetable_id, || {
                    ScenarioError::TimetableNotFound { timetable_id }
                })
                .await?;

                // Check if the infra exists
                if !Infra::exists(&mut conn.clone(), infra_id).await? {
                    return Err(ScenarioError::InfraNotFound { infra_id }.into());
                }

                // Create Scenario
                let scenario = scenario
                    .study_id(study_id)
                    .create(&mut conn.clone())
                    .await?;

                // Update study last_modification field
                study
                    .clone()
                    .update_last_modified(&mut conn.clone())
                    .await?;

                // Update project last_modification field
                project.update_last_modified(&mut conn.clone()).await?;

                let scenarios_with_details =
                    ScenarioWithDetails::from_scenario(scenario, &mut conn.clone()).await?;

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
    delete, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 204, description = "The scenario was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    }): Path<ScenarioPathParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                // Check if the project and the study exist
                let (mut project, study) =
                    check_project_study(&mut conn.clone(), project_id, study_id)
                        .await
                        .unwrap();

                // Delete scenario
                Scenario::delete_static_or_fail(&mut conn.clone(), scenario_id, || {
                    ScenarioError::NotFound { scenario_id }
                })
                .await?;

                // Update project last_modification field
                project.update_last_modified(&mut conn.clone()).await?;

                // Update study last_modification field
                study
                    .clone()
                    .update_last_modified(&mut conn.clone())
                    .await?;

                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// This structure is used by the patch endpoint to patch a scenario
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ScenarioPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Tags>,
    pub infra_id: Option<i64>,
    #[serde(default, with = "double_option")]
    pub electrical_profile_set_id: Option<Option<i64>>,
}

impl From<ScenarioPatchForm> for <Scenario as crate::models::Model>::Changeset {
    fn from(scenario: ScenarioPatchForm) -> Self {
        Scenario::changeset()
            .flat_name(scenario.name)
            .flat_description(scenario.description)
            .flat_tags(scenario.tags)
            .flat_infra_id(scenario.infra_id)
            .flat_electrical_profile_set_id(scenario.electrical_profile_set_id)
            .last_modification(Utc::now().naive_utc())
    }
}

/// Update a scenario
#[utoipa::path(
    patch, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    request_body = ScenarioPatchForm,
    responses(
        (status = 204, body = ScenarioResponse, description = "The scenario was updated successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn patch(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    }): Path<ScenarioPathParam>,
    Json(form): Json<ScenarioPatchForm>,
) -> Result<Json<ScenarioResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let scenarios_response = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                // Check if project and study exist
                let (mut project, study) =
                    check_project_study(&mut conn.clone(), project_id, study_id).await?;

                // Check if the infra exists
                if let Some(infra_id) = form.infra_id {
                    if !Infra::exists(&mut conn.clone(), infra_id).await? {
                        return Err(ScenarioError::InfraNotFound { infra_id }.into());
                    }
                }

                // Update the scenario
                let scenario: Changeset<Scenario> = form.into();
                let scenario = scenario
                    .update_or_fail(&mut conn.clone(), scenario_id, || ScenarioError::NotFound {
                        scenario_id,
                    })
                    .await?;

                // Update study last_modification field
                study
                    .clone()
                    .update_last_modified(&mut conn.clone())
                    .await?;

                // Update project last_modification field
                project.update_last_modified(&mut conn.clone()).await?;

                let scenario_with_details =
                    ScenarioWithDetails::from_scenario(scenario, &mut conn.clone()).await?;

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
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 200, body = ScenarioResponse, description = "The requested scenario"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(ScenarioPathParam {
        project_id,
        study_id,
        scenario_id,
    }): Path<ScenarioPathParam>,
) -> Result<Json<ScenarioResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, PaginationQueryParams, OperationalStudiesOrderingParam),
    responses(
        (status = 200, description = "A paginated list of scenarios", body = inline(ListScenariosResponse)),
        (status = 404, description = "Project or study doesn't exist")
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id)): Path<(i64, i64)>,
    Query(pagination_params): Query<PaginationQueryParams>,
    Query(OperationalStudiesOrderingParam { ordering }): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ListScenariosResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let _ = check_project_study(conn, project_id, study_id).await?;

    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings()
        .order_by(move || ordering.as_scenario_ordering())
        .filter(move || Scenario::STUDY_ID.eq(study_id));
    let (scenarios, stats) = Scenario::list_paginated(conn, settings).await?;

    let futs = scenarios
        .into_iter()
        .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
        .map(|(scenario, conn)| async {
            ScenarioWithDetails::from_scenario(scenario, &mut conn.await?).await
        });
    let results = futures::future::try_join_all(futs).await?;

    Ok(Json(ListScenariosResponse { stats, results }))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::fixtures::create_project;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::models::fixtures::create_study;
    use crate::models::fixtures::create_timetable;
    use crate::views::test_app::TestAppBuilder;

    pub fn scenario_url(project_id: i64, study_id: i64, scenario_id: Option<i64>) -> String {
        format!(
            "/projects/{}/studies/{}/scenarios/{}",
            project_id,
            study_id,
            scenario_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    #[rstest]
    async fn get_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );
        let request = app.get(&url);

        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario, fixtures.scenario);
    }

    #[rstest]
    async fn get_scenarios() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(fixtures.project.id, fixtures.study.id, None);
        let request = app.get(&url);

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

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(fixtures.project.id, 99999999, Some(fixtures.scenario.id));

        let request = app.get(&url);

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn post_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let project = create_project(&mut pool.get_ok(), "project_test_name").await;
        let study = create_study(&mut pool.get_ok(), "study_test_name", project.id).await;
        let infra = create_empty_infra(&mut pool.get_ok()).await;
        let timetable = create_timetable(&mut pool.get_ok()).await;

        let url = scenario_url(project.id, study.id, None);

        let study_name = "new created scenario";
        let study_description = "new created scenario description";
        let study_timetable_id = timetable.id;
        let study_infra_id = infra.id;
        let study_tags = Tags::new(vec!["tag1".to_string(), "tag2".to_string()]);

        // Insert scenario
        let request = app.post(&url).json(&json!({
            "name": study_name,
            "description": study_description,
            "infra_id": study_infra_id,
            "timetable_id": study_timetable_id,
            "tags": study_tags
        }));

        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario.name, study_name);
        assert_eq!(response.scenario.description, study_description);
        assert_eq!(response.scenario.infra_id, study_infra_id);
        assert_eq!(response.scenario.timetable_id, study_timetable_id);
        assert_eq!(response.scenario.tags, study_tags);

        let created_scenario = Scenario::retrieve(&mut pool.get_ok(), response.scenario.id)
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

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );

        let study_name = "new patched scenario";
        let study_description = "new patched scenario description";
        let study_tags = Tags::new(vec!["patched_tag1".to_string(), "patched_tag2".to_string()]);

        // Update scenario
        let request = app.patch(&url).json(&json!({
            "name": study_name,
            "description": study_description,
            "tags": study_tags
        }));
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

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );

        // Update scenario
        let request = app.patch(&url).json(&json!({
            "infra_id": 999999999,
        }));

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn patch_infra_id_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;
        let other_infra = create_empty_infra(&mut pool.get_ok()).await;

        assert_eq!(fixtures.scenario.infra_id, fixtures.infra.id);
        assert_ne!(fixtures.scenario.infra_id, other_infra.id);

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );

        let study_name = "new patched scenario V2";
        let study_other_infra_id = other_infra.id;

        let request = app.patch(&url).json(&json!({
            "name": study_name,
            "infra_id": study_other_infra_id,
        }));
        let response: ScenarioResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(response.scenario.infra_id, study_other_infra_id);
        assert_eq!(response.scenario.name, study_name);
    }

    #[rstest]
    async fn delete_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(
            fixtures.project.id,
            fixtures.study.id,
            Some(fixtures.scenario.id),
        );
        let request = app.delete(&url);

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let exists = Scenario::exists(&mut pool.get_ok(), fixtures.scenario.id)
            .await
            .expect("Failed to check if scenario exists");

        assert!(!exists);
    }
}
