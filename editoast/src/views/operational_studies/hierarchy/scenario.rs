use authz::ProjectPrivilege;
use authz::Role;
use authz::v2::project_privilege_check;
use axum::Extension;
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
use models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use serde_with::rust::double_option;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::OperationalStudiesOrderingParam;
use super::project::ProjectError;
use super::study::StudyError;
use crate::AppState;
use crate::authentication;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use models::Infra;
use models::project::Project;
use models::scenario::Scenario;
use models::study::Study;
use models::tags::Tags;
use models::timetable::Timetable;

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
    #[from(models::Error, database::DatabaseError)]
    Database(models::Error),
}

impl From<models::scenario::Error> for ScenarioError {
    fn from(e: models::scenario::Error) -> Self {
        match e {
            models::scenario::Error::NotFound { scenario_id } => {
                ScenarioError::NotFound { scenario_id }
            }
            models::scenario::Error::Database(e) => ScenarioError::Database(e),
        }
    }
}

impl From<models::study::Error> for ScenarioError {
    fn from(e: models::study::Error) -> Self {
        match e {
            models::study::Error::NotFound { study_id } => {
                ScenarioError::StudyNotFound { study_id }
            }
            models::study::Error::Database(e) => ScenarioError::Database(e),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ScenarioWithDetails {
    #[serde(flatten)]
    pub scenario: Scenario,
    pub infra_name: String,
    pub train_schedules_count: i64,
    pub timetable_type: schemas::timetable_type::TimetableType,
}

impl ScenarioWithDetails {
    pub async fn from_scenario(
        scenario: Scenario,
        conn: &mut DbConnection,
    ) -> Result<Self, ScenarioError> {
        let timetable = Timetable::retrieve_or_fail(conn.clone(), scenario.timetable_id, || {
            ScenarioError::TimetableNotFound {
                timetable_id: scenario.timetable_id,
            }
        })
        .await?;
        Ok(Self {
            infra_name: scenario.infra_name(conn).await?,
            train_schedules_count: scenario.train_schedules_count(conn).await?,
            scenario,
            timetable_type: timetable.timetable_type.0,
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
    pub timetable_type: schemas::timetable_type::TimetableType,
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
            timetable_type: scenarios_with_details.timetable_type,
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
    let infra_id = data.infra_id;
    let study_id = data.study_id;
    let scenario_cs = data.into_changeset();

    let details = Study::transactional_content_update(
        db_pool.get().await?,
        study_id,
        async move |mut conn, study, _project| {
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
    State(AppState {
        db_pool,
        openfga,
        config,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
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

    if config.enable_project_permissions {
        project_privilege_check(authz::Project(project.id), ProjectPrivilege::HasAccess)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await?;
    }

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

    let futures = scenarios
        .into_iter()
        .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
        .map(|(scenario, conn)| async {
            ScenarioWithDetails::from_scenario(scenario, &mut conn.await?)
                .await
                .map_err(InternalError::from)
        });
    let results = futures::future::try_join_all(futures).await?;

    Ok(Json(ListScenariosResponse { stats, results }))
}

#[cfg(test)]
mod tests {
    use authz::ProjectGrant;
    use pretty_assertions::assert_eq;

    use rstest::rstest;
    use serde_json::json;

    use super::*;
    #[cfg(test)]
    use crate::fixtures::ScenarioFixtureSet;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_project;
    use crate::fixtures::create_scenario_fixtures_set;
    use crate::fixtures::create_study;
    use crate::fixtures::create_timetable;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt as _;

    pub fn scenario_url(scenario_id: Option<i64>) -> String {
        format!(
            "/scenarios/{}",
            scenario_id.map_or_else(|| "".to_owned(), |v| v.to_string())
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn scenarios_get() {
        let app = test_app!().build();
        let fixtures = create_scenario_fixtures_set(&mut app.db_pool().get_ok(), "scenario").await;
        let user = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_project_grant(fixtures.project_id, ProjectGrant::Owner)
            .create()
            .await;
        let response: ScenarioResponse = app
            .get(&format!("/scenarios/{}", fixtures.scenario.id))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.scenario, fixtures.scenario);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn scenarios_get_admin_allowed() {
        let app = test_app!().build();
        let fixtures = create_scenario_fixtures_set(&mut app.db_pool().get_ok(), "scenario").await;
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        app.get(&format!("/scenarios/{}", fixtures.scenario.id))
            .by_user(admin.as_ref())
            .await
            .assert_status_ok();
    }

    #[rstest]
    #[case::no_role(
        test_app!().build(),
        create_scenario_fixtures_set(&mut app.db_pool().get_ok(), "scenario").await,
        app
            .user("bob", "Bob")
            .with_project_grant(fixtures.project_id, ProjectGrant::Owner)
            .create()
            .await
    )]
    #[case::no_grant(
        test_app!().build(),
        create_scenario_fixtures_set(&mut app.db_pool().get_ok(), "scenario").await,
        app
            .user("bob", "Bob")
            .with_roles([Role::OperationalStudies])
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn scenario_get_forbidden(
        #[case] app: TestApp,
        #[case] fixtures: ScenarioFixtureSet,
        #[case] user_forbidden: authz::identity::User,
    ) {
        let user_authorized = app
            .user("alice", "Alice")
            .with_roles([Role::OperationalStudies])
            .with_project_grant(fixtures.project_id, ProjectGrant::Owner)
            .create()
            .await;
        app.get(&format!("/scenarios/{}", fixtures.scenario.id))
            .by_user(user_forbidden.as_ref())
            .await
            .assert_status_forbidden();
        app.get(&format!("/scenarios/{}", fixtures.scenario.id))
            .by_user(user_authorized.as_ref())
            .await
            .assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn scenario_get_not_found() {
        let app = test_app!().build();
        let ScenarioFixtureSet { scenario, .. } =
            create_scenario_fixtures_set(&mut app.db_pool().get_ok(), "scenario").await;
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.get(&format!("/scenarios/{}", scenario.id + 1000))
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_scenarios() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(None);
        let mut response: ListScenariosResponse = app
            .get(&url)
            .add_query_params(json!({"study_id": fixtures.scenario.study_id}))
            .await
            .assert_status_ok()
            .json();

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
        let app = test_app!().skip_authz().build();
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
        let response: ScenarioWithDetails = app
            .post(&url)
            .json(&json!({
                "name": scenario_name,
                "description": scenario_description,
                "infra_id": scenario_infra_id,
                "timetable_id": scenario_timetable_id,
                "tags": scenario_tags,
                "study_id": study.id
            }))
            .await
            .assert_status(StatusCode::CREATED)
            .json();

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
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));

        let scenario_name = "new patched scenario";
        let scenario_description = "new patched scenario description";
        let scenario_tags = Tags::new(vec!["patched_tag1".to_string(), "patched_tag2".to_string()]);

        // Update scenario
        let response: ScenarioWithDetails = app
            .patch(&url)
            .json(&json!({
                "name": scenario_name,
                "description": scenario_description,
                "tags": scenario_tags
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.scenario.name, scenario_name);
        assert_eq!(response.scenario.description, scenario_description);
        assert_eq!(response.scenario.tags, scenario_tags);
        assert!(response.scenario.last_modification > fixtures.scenario.last_modification);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_scenario_with_unavailable_infra() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));

        // Update scenario
        app.patch(&url)
            .json(&json!({
                "infra_id": 999999999,
            }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_infra_id_scenario() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;
        let other_infra = create_empty_infra(&mut pool.get_ok()).await;

        assert_eq!(fixtures.scenario.infra_id, fixtures.infra.id);
        assert_ne!(fixtures.scenario.infra_id, other_infra.id);

        let url = scenario_url(Some(fixtures.scenario.id));

        let scenario_name = "new patched scenario V2";
        let scenario_other_infra_id = other_infra.id;

        let response: ScenarioWithDetails = app
            .patch(&url)
            .json(&json!({
                "name": scenario_name,
                "infra_id": scenario_other_infra_id,
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.scenario.infra_id, scenario_other_infra_id);
        assert_eq!(response.scenario.name, scenario_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_scenario() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let fixtures = create_scenario_fixtures_set(&mut pool.get_ok(), "test_scenario_name").await;

        let url = scenario_url(Some(fixtures.scenario.id));
        app.delete(&url).await.assert_status_no_content();

        let exists = Scenario::exists(&mut pool.get_ok(), fixtures.scenario.id)
            .await
            .expect("Failed to check if scenario exists");

        assert!(!exists);
    }
}
