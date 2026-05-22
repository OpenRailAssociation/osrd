use authz::Role;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::Utc;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::study::StudyError;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::operational_studies::OperationalStudiesOrderingParam;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::project::ProjectError;
use editoast_models::Infra;
use editoast_models::project::Project;
use editoast_models::scenario::Scenario;
use editoast_models::study::Study;
use editoast_models::tags::Tags;
use editoast_models::timetable::Timetable;

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct ScenarioIdParam {
    scenario_id: i64,
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Default, ToSchema)]
pub(in crate::views) struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra_id: i64,
    pub timetable_id: i64,
    pub study_id: i64,
    #[serde(default)]
    pub tags: Tags,
    pub electrical_profile_set_id: Option<i64>,
}

impl ScenarioCreateForm {
    pub fn into_changeset(self) -> Changeset<Scenario> {
        Scenario::changeset()
            .name(self.name)
            .description(self.description)
            .creation_date(Utc::now())
            .last_modification(Utc::now())
            .infra_id(self.infra_id)
            .timetable_id(self.timetable_id)
            .tags(self.tags)
            .electrical_profile_set_id(self.electrical_profile_set_id)
            .study_id(self.study_id)
    }
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "scenario")]
#[allow(clippy::enum_variant_names)]
pub enum ScenarioError {
    #[error("Study '{study_id}', could not be found")]
    #[editoast_error(status = 404)]
    StudyNotFound { study_id: i64 },

    #[error("Scenario '{scenario_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { scenario_id: i64 },

    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },

    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(editoast_models::Error, database::DatabaseError)]
    Database(editoast_models::Error),
}

impl From<editoast_models::scenario::Error> for ScenarioError {
    fn from(e: editoast_models::scenario::Error) -> Self {
        match e {
            editoast_models::scenario::Error::NotFound { scenario_id } => {
                ScenarioError::NotFound { scenario_id }
            }
            editoast_models::scenario::Error::Database(e) => ScenarioError::Database(e),
        }
    }
}

impl From<editoast_models::study::Error> for ScenarioError {
    fn from(e: editoast_models::study::Error) -> Self {
        match e {
            editoast_models::study::Error::NotFound { study_id } => {
                ScenarioError::StudyNotFound { study_id }
            }
            editoast_models::study::Error::Database(e) => ScenarioError::Database(e),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ScenarioWithDetails {
    #[serde(flatten)]
    pub scenario: Scenario,
    pub infra_name: String,
    pub train_schedules_count: i64,
}

impl ScenarioWithDetails {
    pub async fn from_scenario(
        scenario: Scenario,
        conn: &mut DbConnection,
    ) -> Result<Self, database::DatabaseError> {
        Ok(Self {
            infra_name: scenario.infra_name(conn).await?,
            train_schedules_count: scenario.train_schedules_count(conn).await?,
            scenario,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ScenarioResponse {
    #[serde(flatten)]
    pub scenario: Scenario,
    pub infra_name: String,
    pub train_schedules_count: i64,
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
            train_schedules_count: scenarios_with_details.train_schedules_count,
            project,
            study,
        }
    }
}

/// Create a scenario
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    request_body = ScenarioCreateForm,
    responses(
        (status = 201, body = ScenarioWithDetails, description = "The created scenario"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(data): Json<ScenarioCreateForm>,
) -> Result<impl IntoResponse> {
    let timetable_id = data.timetable_id;
    let infra_id = data.infra_id;
    let study_id = data.study_id;
    let scenario_cs = data.into_changeset();

    let details = Study::transactional_content_update(
        db_pool.get().await?,
        study_id,
        async move |mut conn, study, _project| {
            Timetable::exists_or_fail(&mut conn, timetable_id, || {
                ScenarioError::TimetableNotFound { timetable_id }
            })
            .await?;

            Infra::exists_or_fail(&mut conn, infra_id, || ScenarioError::InfraNotFound {
                infra_id,
            })
            .await?;

            let scenario = scenario_cs.study_id(study.id).create(&mut conn).await?;

            let details = ScenarioWithDetails::from_scenario(scenario, &mut conn).await?;
            Ok::<_, InternalError>(details)
        },
    )
    .await
    .map_err(ScenarioError::from)??;

    Ok((StatusCode::CREATED, Json(details)))
}

/// Delete a scenario
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "scenarios",
    params(ScenarioIdParam),
    responses(
        (status = 204, description = "The scenario was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(ScenarioIdParam { scenario_id }): Path<ScenarioIdParam>,
) -> Result<impl IntoResponse> {
    let conn = db_pool.get().await?;

    conn.transaction(async move |conn| {
        let scenario = Scenario::retrieve_or_fail(conn.clone(), scenario_id, || {
            ScenarioError::NotFound { scenario_id }
        })
        .await?;

        Study::transactional_content_update(
            conn,
            scenario.study_id,
            async move |mut conn, _study, _project| {
                scenario.delete(&mut conn).await?;
                Ok::<_, ScenarioError>(())
            },
        )
        .await
        .map_err(ScenarioError::from)??;

        Ok::<_, ScenarioError>(())
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// This structure is used by the patch endpoint to patch a scenario
#[derive(Serialize, Deserialize, Default, ToSchema)]
pub(in crate::views) struct ScenarioPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Tags>,
    pub infra_id: Option<i64>,
    #[serde(default, with = "double_option")]
    pub electrical_profile_set_id: Option<Option<i64>>,
}

impl ScenarioPatchForm {
    pub fn into_changeset(self) -> Changeset<Scenario> {
        Scenario::changeset()
            .flat_name(self.name)
            .flat_description(self.description)
            .flat_tags(self.tags)
            .flat_infra_id(self.infra_id)
            .flat_electrical_profile_set_id(self.electrical_profile_set_id)
            .last_modification(Utc::now())
    }
}

/// Update a scenario
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    patch, path = "",
    tag = "scenarios",
    params(ScenarioIdParam),
    request_body = ScenarioPatchForm,
    responses(
        (status = 200, body = ScenarioWithDetails, description = "The scenario was updated successfully"),
    )
)]
pub(in crate::views) async fn patch(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(ScenarioIdParam { scenario_id }): Path<ScenarioIdParam>,
    Json(form): Json<ScenarioPatchForm>,
) -> Result<impl IntoResponse> {
    let details = Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        async move |mut conn, _scenario, _study, _project| {
            if let Some(infra_id) = form.infra_id {
                Infra::exists_or_fail(&mut conn, infra_id, || ScenarioError::InfraNotFound {
                    infra_id,
                })
                .await?;
            }

            let scenario_cs = form.into_changeset();
            let scenario = scenario_cs
                .update_or_fail(&mut conn, scenario_id, || ScenarioError::NotFound {
                    scenario_id,
                })
                .await?;

            let details = ScenarioWithDetails::from_scenario(scenario, &mut conn).await?;
            Ok::<_, ScenarioError>(details)
        },
    )
    .await
    .map_err(ScenarioError::from)??;

    Ok(Json(details))
}

/// Return a specific scenario
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ScenarioIdParam),
    responses(
        (status = 200, body = ScenarioResponse, description = "The requested scenario"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(ScenarioIdParam { scenario_id }): Path<ScenarioIdParam>,
) -> Result<Json<ScenarioResponse>> {
    let (details, project, study) = db_pool
        .get()
        .await?
        .transaction(async move |mut conn| {
            let scenario = Scenario::retrieve_or_fail(conn.clone(), scenario_id, || {
                ScenarioError::NotFound { scenario_id }
            })
            .await?;
            let study =
                Study::retrieve_or_fail(conn.clone(), scenario.study_id, || StudyError::NotFound {
                    study_id: scenario.study_id,
                })
                .await?;
            let project = Project::retrieve_or_fail(conn.clone(), study.project_id, || {
                ProjectError::NotFound {
                    project_id: study.project_id,
                }
            })
            .await?;

            Ok::<_, InternalError>((
                ScenarioWithDetails::from_scenario(scenario, &mut conn).await?,
                project,
                study,
            ))
        })
        .await?;

    Ok(Json(ScenarioResponse::new(details, project, study)))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct ListScenariosResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<ScenarioWithDetails>,
}

#[derive(IntoParams, Deserialize)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ListScenariosQueryParams {
    #[param(inline)]
    study_id: i64,
}

/// Return a list of scenarios
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ListScenariosQueryParams, PaginationQueryParams<1000>, OperationalStudiesOrderingParam),
    responses(
        (status = 200, description = "A paginated list of scenarios", body = inline(ListScenariosResponse)),
        (status = 404, description = "Project or study doesn't exist")
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Query(ListScenariosQueryParams { study_id }): Query<ListScenariosQueryParams>,
    Query(pagination_params): Query<PaginationQueryParams<1000>>,
    Query(OperationalStudiesOrderingParam { ordering }): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<ListScenariosResponse>> {
    let conn = &mut db_pool.get().await?;

    let settings = pagination_params
        .into_selection_settings()
        .order_by(move || ordering.as_scenario_ordering())
        .filter(move || Scenario::STUDY_ID.eq(study_id));
    let (scenarios, stats) = Scenario::list_paginated(conn, settings).await?;

    let futs = scenarios
        .into_iter()
        .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
        .map(|(scenario, conn)| async {
            ScenarioWithDetails::from_scenario(scenario, &mut conn.await?)
                .await
                .map_err(InternalError::from)
        });
    let results = futures::future::try_join_all(futs).await?;

    Ok(Json(ListScenariosResponse { stats, results }))
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use serde_json::json;

    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_project;
    use crate::fixtures::create_scenario_fixtures_set;
    use crate::fixtures::create_study;
    use crate::fixtures::create_timetable;
    use crate::views::test_app::TestAppBuilder;

    pub fn scenario_url(scenario_id: Option<i64>) -> String {
        format!(
            "/scenarios/{}",
            scenario_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));
        let request = app.get(&url);

        let response: ScenarioResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.scenario, fixtures.scenario);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_scenarios() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(None);
        let request = app
            .get(&url)
            .add_query_params(json!({"study_id": fixtures.scenario.study_id}));

        let mut response: ListScenariosResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn post_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let project = create_project(&mut pool.get_ok(), "project_test_name").await;
        let study = create_study(&mut pool.get_ok(), "study_test_name", project.id).await;
        let infra = create_empty_infra(&mut pool.get_ok()).await;
        let timetable = create_timetable(&mut pool.get_ok()).await;

        let url = scenario_url(None);

        let scenario_name = "new created scenario";
        let scenario_description = "new created scenario description";
        let scenario_timetable_id = timetable.id;
        let scenario_infra_id = infra.id;
        let scenario_tags = Tags::new(vec!["tag1".to_string(), "tag2".to_string()]);

        // Insert scenario
        let request = app.post(&url).json(&json!({
            "name": scenario_name,
            "description": scenario_description,
            "infra_id": scenario_infra_id,
            "timetable_id": scenario_timetable_id,
            "tags": scenario_tags,
            "study_id": study.id
        }));

        let response: ScenarioWithDetails = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        assert_eq!(response.scenario.name, scenario_name);
        assert_eq!(response.scenario.description, scenario_description);
        assert_eq!(response.scenario.infra_id, scenario_infra_id);
        assert_eq!(response.scenario.timetable_id, scenario_timetable_id);
        assert_eq!(response.scenario.tags, scenario_tags);
        assert_eq!(response.scenario.study_id, study.id);

        let created_scenario = Scenario::retrieve(pool.get_ok(), response.scenario.id)
            .await
            .expect("Failed to retrieve scenario")
            .expect("Scenario not found");

        assert_eq!(created_scenario.name, scenario_name);
        assert_eq!(created_scenario.description, scenario_description);
        assert_eq!(created_scenario.infra_id, scenario_infra_id);
        assert_eq!(created_scenario.timetable_id, scenario_timetable_id);
        assert_eq!(created_scenario.tags, scenario_tags);
        assert_eq!(created_scenario.study_id, study.id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));

        let scenario_name = "new patched scenario";
        let scenario_description = "new patched scenario description";
        let scenario_tags = Tags::new(vec!["patched_tag1".to_string(), "patched_tag2".to_string()]);

        // Update scenario
        let request = app.patch(&url).json(&json!({
            "name": scenario_name,
            "description": scenario_description,
            "tags": scenario_tags
        }));
        let response: ScenarioWithDetails = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.scenario.name, scenario_name);
        assert_eq!(response.scenario.description, scenario_description);
        assert_eq!(response.scenario.tags, scenario_tags);
        assert!(response.scenario.last_modification > fixtures.scenario.last_modification);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_scenario_with_unavailable_infra() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));

        // Update scenario
        let request = app.patch(&url).json(&json!({
            "infra_id": 999999999,
        }));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_infra_id_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;
        let other_infra = create_empty_infra(&mut pool.get_ok()).await;

        assert_eq!(fixtures.scenario.infra_id, fixtures.infra.id);
        assert_ne!(fixtures.scenario.infra_id, other_infra.id);

        let url = scenario_url(Some(fixtures.scenario.id));

        let scenario_name = "new patched scenario V2";
        let scenario_other_infra_id = other_infra.id;

        let request = app.patch(&url).json(&json!({
            "name": scenario_name,
            "infra_id": scenario_other_infra_id,
        }));
        let response: ScenarioWithDetails = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.scenario.infra_id, scenario_other_infra_id);
        assert_eq!(response.scenario.name, scenario_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_scenario() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));
        let request = app.delete(&url);

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = Scenario::exists(&mut pool.get_ok(), fixtures.scenario.id)
            .await
            .expect("Failed to check if scenario exists");

        assert!(!exists);
    }
}
