use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::models::macro_node::MacroNode;
use crate::models::prelude::*;
use crate::models::Project;
use crate::models::Scenario;
use crate::models::Study;
use crate::models::Tags;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;
use crate::views::projects::ProjectError;
use crate::views::projects::ProjectIdParam;
use crate::views::scenario::ScenarioError;
use crate::views::scenario::ScenarioIdParam;
use crate::views::study::StudyError;
use crate::views::study::StudyIdParam;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;

crate::routes! {
    "/macro_nodes" => {list, create,},
    "/macro_nodes/{node_id}" => {get, update, delete,},
}

editoast_common::schemas! {
    MacroNodeForm,
    MacroNodeResponse,
    MacroNodeListResponse,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "macro_node")]
enum MacroNodeError {
    #[error("Node '{node_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { node_id: i64 },
}

#[derive(IntoParams, Deserialize)]
#[allow(unused)]
struct MacroNodeIdParam {
    node_id: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
struct MacroNodeForm {
    position_x: f64,
    position_y: f64,
    full_name: Option<String>,
    connection_time: i64,
    labels: Tags,
    trigram: Option<String>,
    path_item_key: String,
}

impl MacroNodeForm {
    pub fn into_macro_node_changeset(self, scenario_id: i64) -> Result<Changeset<MacroNode>> {
        let macro_node = MacroNode::changeset()
            .scenario_id(scenario_id)
            .position_x(self.position_x)
            .position_y(self.position_y)
            .full_name(self.full_name)
            .connection_time(self.connection_time)
            .labels(self.labels)
            .trigram(self.trigram)
            .path_item_key(self.path_item_key);

        Ok(macro_node)
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
struct MacroNodeResponse {
    id: i64,
    position_x: f64,
    position_y: f64,
    full_name: Option<String>,
    connection_time: i64,
    labels: Tags,
    trigram: Option<String>,
    path_item_key: String,
}

impl From<MacroNode> for MacroNodeResponse {
    fn from(node: MacroNode) -> Self {
        Self {
            id: node.id,
            position_x: node.position_x,
            position_y: node.position_y,
            full_name: node.full_name,
            connection_time: node.connection_time,
            labels: node.labels,
            trigram: node.trigram,
            path_item_key: node.path_item_key,
        }
    }
}

impl PartialEq<MacroNodeResponse> for MacroNode {
    fn eq(&self, other: &MacroNodeResponse) -> bool {
        self.id == other.id
            && self.position_x == other.position_x
            && self.position_y == other.position_y
            && self.full_name == other.full_name
            && self.connection_time == other.connection_time
            && self.labels == other.labels
            && self.trigram == other.trigram
            && self.path_item_key == other.path_item_key
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct MacroNodeListResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<MacroNodeResponse>,
}

/// Get macro node list by scneario id
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, PaginationQueryParam),
    responses(
        (status = 200, body = MacroNodeListResponse, description = "List of macro nodes for the requested scenario"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    Query(pagination_params): Query<PaginationQueryParam>,
) -> Result<Json<MacroNodeListResponse>> {
    // Checking role
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    // Check for project / study / scenario
    check_project_study_scenario(conn, project_id, study_id, scenario_id).await?;

    // Ask the db
    let settings = pagination_params
        .validate(100)?
        .into_selection_settings()
        .filter(move || MacroNode::SCENARIO_ID.eq(scenario_id));
    let (result, stats) = MacroNode::list_paginated(conn, settings).await?;

    // Produce the response
    Ok(Json(MacroNodeListResponse {
        stats,
        results: result
            .into_iter()
            .map(MacroNodeResponse::from)
            .collect_vec(),
    }))
}

#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    request_body = MacroNodeForm,
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 201, body = MacroNodeResponse, description = "Macro node created"),
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    Json(data): Json<MacroNodeForm>,
) -> Result<Json<MacroNodeResponse>> {
    // Checking role
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let created = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                let db_conn = &mut conn.clone();
                // check if scneario exists
                let (mut project, mut study, mut scenario) =
                    check_project_study_scenario(db_conn, project_id, study_id, scenario_id)
                        .await?;

                // save the node
                let macro_node = data
                    .into_macro_node_changeset(scenario_id)?
                    .create(db_conn)
                    .await?;

                // Update last_modification fields
                scenario.update_last_modified(db_conn).await?;
                study.update_last_modified(db_conn).await?;
                project.update_last_modified(db_conn).await?;

                Ok(macro_node)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(MacroNodeResponse::from(created)))
}

#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNodeIdParam),
    responses(
        (status = 200, body = MacroNodeResponse, description = "The requested Macro node"),
        (status = 404, body = InternalError, description = "The macro node was not found"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, node_id)): Path<(i64, i64, i64, i64)>,
) -> Result<Json<MacroNodeResponse>> {
    // Checking role
    let authorized = auth
        .check_roles([BuiltinRole::OpsRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    // Check for project / study / scenario
    let conn = &mut db_pool.get().await?;
    check_project_study_scenario(conn, project_id, study_id, scenario_id).await?;

    // Get / check the node
    let macro_node = retrieve_macro_node_and_check_scenario(conn, scenario_id, node_id).await?;

    Ok(Json(MacroNodeResponse::from(macro_node)))
}

#[utoipa::path(
    put, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNodeIdParam),
    request_body = MacroNodeForm,
    responses(
        (status = 200, body = MacroNodeResponse, description = "The requested scenario"),
        (status = 404, body = InternalError, description = "The macro node was not found"),
    )
)]
async fn update(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, node_id)): Path<(i64, i64, i64, i64)>,
    Json(data): Json<MacroNodeForm>,
) -> Result<Json<MacroNodeResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let updated = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                let db_conn = &mut conn.clone();

                // Get / check the node
                let (mut project, mut study, mut scenario) =
                    check_project_study_scenario(db_conn, project_id, study_id, scenario_id)
                        .await?;
                retrieve_macro_node_and_check_scenario(db_conn, scenario_id, node_id).await?;

                let macro_node = data
                    .into_macro_node_changeset(scenario_id)?
                    .update_or_fail(db_conn, node_id, || ScenarioError::NotFound { scenario_id })
                    .await?;

                // Update last_modification fields
                scenario.update_last_modified(db_conn).await?;
                study.update_last_modified(db_conn).await?;
                project.update_last_modified(db_conn).await?;

                Ok(macro_node)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(MacroNodeResponse::from(updated)))
}

#[utoipa::path(
    delete, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNodeIdParam),
    responses(
        (status = 204, description = "The macro node was deleted successfully"),
        (status = 404, body = InternalError, description = "The macro node was not found"),
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, node_id)): Path<(i64, i64, i64, i64)>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::OpsWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                let db_conn = &mut conn.clone();

                // Get / check the node
                let (mut project, mut study, mut scenario) =
                    check_project_study_scenario(db_conn, project_id, study_id, scenario_id)
                        .await?;

                let macro_node =
                    retrieve_macro_node_and_check_scenario(db_conn, scenario_id, node_id).await?;

                // Delete
                macro_node.delete(db_conn).await?;

                // Update last_modification fields
                scenario.update_last_modified(db_conn).await?;
                study.update_last_modified(db_conn).await?;
                project.update_last_modified(db_conn).await?;

                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn check_project_study_scenario(
    conn: &mut DbConnection,
    project_id: i64,
    study_id: i64,
    scenario_id: i64,
) -> Result<(Project, Study, Scenario)> {
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
    let study =
        Study::retrieve_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    if study.project_id != project_id {
        return Err(StudyError::NotFound { study_id }.into());
    }

    let scenario = Scenario::retrieve_or_fail(conn, scenario_id, || ScenarioError::NotFound {
        scenario_id,
    })
    .await?;
    if scenario.study_id != study_id {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    Ok((project, study, scenario))
}

async fn retrieve_macro_node_and_check_scenario(
    conn: &mut DbConnection,
    scenario_id: i64,
    node_id: i64,
) -> Result<MacroNode> {
    let node = MacroNode::retrieve_or_fail(&mut conn.clone(), node_id, || {
        MacroNodeError::NotFound { node_id }
    })
    .await?;
    if node.scenario_id != scenario_id {
        return Err(MacroNodeError::NotFound { node_id }.into());
    }
    Ok(node)
}

#[cfg(test)]
pub mod test {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn create() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let request = app
            .post(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_nodes",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id
            ))
            .json(&json!({
                "position_x": 12,
                "position_y": 51,
                "full_name": "My super node",
                "connection_time": 13,
                "labels": ["",""],
                "path_item_key":"->"
            }));
        let response: MacroNodeResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let node = MacroNode::retrieve_or_fail(&mut db_pool.get_ok(), response.id, || {
            MacroNodeError::NotFound {
                node_id: response.id,
            }
        })
        .await
        .expect("Failed to retrieve node");

        assert_eq!(node.id, response.id);
        assert_eq!(node.full_name, response.full_name);
        assert_eq!(node.position_x, response.position_x);
        assert_eq!(node.position_y, response.position_y);
    }

    #[rstest]
    async fn update() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let request = app
            .put(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_nodes/{}",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id, fixtures.nodes[0].id
            ))
            .json(&json!({
                "position_x": 4.0,
                "position_y": 1.0,
                "full_name": "My super node",
                "connection_time": 13,
                "labels": ["A","B"],
                "path_item_key":"A->B"
            }));
        let response: MacroNodeResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let node = MacroNode::retrieve_or_fail(&mut db_pool.get_ok(), fixtures.nodes[0].id, || {
            MacroNodeError::NotFound {
                node_id: response.id,
            }
        })
        .await
        .expect("Failed to retrieve node");

        let node_labels = node.labels.to_vec();
        assert_eq!(Some("My super node".to_string()), node.full_name);
        assert_eq!(4.0, node.position_x,);
        assert_eq!(1.0, node.position_y);
        assert_eq!("A".to_string(), node_labels[0]);
        assert_eq!("B".to_string(), node_labels[1]);
        assert_eq!(13, node.connection_time);
        assert_eq!("A->B".to_string(), node.path_item_key);
        assert_eq!(None, node.trigram);
    }

    #[rstest]
    async fn get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_nodes/{}",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id, fixtures.nodes[0].id
        ));
        let response: MacroNodeResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(fixtures.nodes[0] == response);
    }

    #[rstest]
    async fn list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 10).await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_nodes?page=1&page_size=5",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id
        ));
        let response: MacroNodeListResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(10, response.stats.count);
        assert_eq!(5, response.results.len());
    }

    #[rstest]
    async fn delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let request = app.delete(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_nodes/{}",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id, fixtures.nodes[0].id
        ));
        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let found = MacroNode::exists(&mut db_pool.get_ok(), fixtures.nodes[0].id)
            .await
            .unwrap();
        assert_eq!(false, found)
    }

    #[rstest]
    async fn retrieve_with_bad_scenario() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let result = retrieve_macro_node_and_check_scenario(
            &mut db_pool.get_ok(),
            fixtures.scenario.id + 1,
            fixtures.nodes[0].id,
        )
        .await;

        assert!(result.is_err());
    }

    fn random_string(n: usize) -> String {
        thread_rng()
            .sample_iter(&Alphanumeric)
            .take(n)
            .map(char::from)
            .collect()
    }

    struct MacroNodeFixtureSet {
        project: Project,
        study: Study,
        scenario: Scenario,
        nodes: Vec<MacroNode>,
    }

    async fn create_macro_node_fixtures_set(
        conn: &mut DbConnection,
        number: usize,
    ) -> MacroNodeFixtureSet {
        let mut rng = rand::thread_rng();
        let fixtures = create_scenario_fixtures_set(conn, "test_scenario_name").await;

        let mut nodes: Vec<MacroNode> = Vec::new();
        for _ in 0..number {
            // Create node
            let node = MacroNode::changeset()
                .scenario_id(fixtures.scenario.id)
                .position_x(rng.gen_range(0.0..100.0))
                .position_y(rng.gen_range(0.0..100.0))
                .full_name(Some(random_string(10)))
                .connection_time(rng.gen::<i64>())
                .labels(Tags::new(vec![random_string(5), random_string(5)]))
                .trigram(Some(random_string(3)))
                .path_item_key(random_string(10))
                .create(conn)
                .await
                .expect("Failed to create macro node");

            nodes.push(node)
        }

        MacroNodeFixtureSet {
            project: fixtures.project,
            study: fixtures.study,
            scenario: fixtures.scenario,
            nodes,
        }
    }
}
