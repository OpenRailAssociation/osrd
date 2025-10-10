use std::sync::Arc;

use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnection;
use database::DbConnectionPoolV2;
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::check_project_study_scenario;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Scenario;
use crate::models::macro_node::MacroNode;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::project::ProjectError;
use crate::views::project::ProjectIdParam;
use crate::views::scenario::ScenarioError;
use crate::views::scenario::ScenarioIdParam;
use crate::views::study::StudyError;
use crate::views::study::StudyIdParam;
use editoast_models::prelude::*;
use editoast_models::tags::Tags;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "macro_node")]
enum MacroNodeError {
    #[error("Node '{node_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { node_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(IntoParams, Deserialize)]
#[allow(unused)]
struct MacroNodeIdParam {
    node_id: i64,
}

#[derive(Debug, Deserialize, ToSchema, Clone)]
#[cfg_attr(test, derive(Serialize, PartialEq))]
pub(in crate::views) struct MacroNodeForm {
    position_x: i64,
    position_y: i64,
    full_name: Option<String>,
    connection_time: i64,
    labels: Tags,
    trigram: Option<String>,
    path_item_key: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize, PartialEq))]
pub(in crate::views) struct MacroNodeBatchForm {
    macro_nodes: Vec<MacroNodeForm>,
}

impl MacroNodeForm {
    pub fn into_macro_node_changeset(self, scenario_id: i64) -> Changeset<MacroNode> {
        MacroNode::changeset()
            .scenario_id(scenario_id)
            .position_x(self.position_x)
            .position_y(self.position_y)
            .full_name(self.full_name)
            .connection_time(self.connection_time)
            .labels(self.labels)
            .trigram(self.trigram)
            .path_item_key(self.path_item_key)
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct MacroNodeResponse {
    id: i64,
    position_x: i64,
    position_y: i64,
    full_name: Option<String>,
    connection_time: i64,
    labels: Tags,
    trigram: Option<String>,
    path_item_key: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct MacroNodeBatchResponse {
    macro_nodes: Vec<MacroNodeResponse>,
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

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct MacroNodeListResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<MacroNodeResponse>,
}

/// Get macro node list by scenario id
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, PaginationQueryParams<100>),
    responses(
        (status = 200, body = MacroNodeListResponse, description = "List of macro nodes for the requested scenario"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    Query(pagination_params): Query<PaginationQueryParams<100>>,
) -> Result<Json<MacroNodeListResponse>> {
    // Checking role
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;

    // Check for project / study / scenario
    check_project_study_scenario(conn.clone(), project_id, study_id, scenario_id).await?;

    // Ask the db
    let settings = pagination_params
        .into_selection_settings()
        .filter(move || MacroNode::SCENARIO_ID.eq(scenario_id));
    let (result, stats) =
        MacroNode::list_paginated(&mut conn, settings.order_by(move || MacroNode::ID.asc()))
            .await?;

    // Produce the response
    Ok(Json(MacroNodeListResponse {
        stats,
        results: result
            .into_iter()
            .map(MacroNodeResponse::from)
            .collect_vec(),
    }))
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    request_body = MacroNodeBatchForm,
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 201, body = MacroNodeBatchResponse, description = "Macro nodes created"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    Json(data): Json<MacroNodeBatchForm>,
) -> Result<impl IntoResponse> {
    // Checking role
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let created = Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        move |mut conn, scenario, study, project| {
            async move {
                if project.id != project_id {
                    return Err::<_, InternalError>(ProjectError::NotFound { project_id }.into());
                }
                if study.id != study_id {
                    return Err(StudyError::NotFound { study_id }.into());
                }
                if scenario.id != scenario_id {
                    return Err(ScenarioError::NotFound { scenario_id }.into());
                }

                let changesets: Vec<_> = data
                    .macro_nodes
                    .into_iter()
                    .map(|node| node.into_macro_node_changeset(scenario_id))
                    .collect();

                let macro_nodes: Vec<_> = MacroNode::create_batch(&mut conn, changesets).await?;

                Ok(macro_nodes)
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(MacroNodeBatchResponse {
            macro_nodes: created.into_iter().map_into().collect(),
        }),
    ))
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNodeIdParam),
    responses(
        (status = 200, body = MacroNodeResponse, description = "The requested Macro node"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, node_id)): Path<(i64, i64, i64, i64)>,
) -> Result<Json<MacroNodeResponse>> {
    // Checking role
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Check for project / study / scenario
    let conn = db_pool.get().await?;
    check_project_study_scenario(conn.clone(), project_id, study_id, scenario_id).await?;

    // Get / check the node
    let macro_node = retrieve_macro_node_and_check_scenario(conn, scenario_id, node_id).await?;

    Ok(Json(MacroNodeResponse::from(macro_node)))
}

#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNodeIdParam),
    request_body = MacroNodeForm,
    responses(
        (status = 200, body = MacroNodeResponse, description = "The updated macro node"),
    )
)]
pub(in crate::views) async fn update(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, node_id)): Path<(i64, i64, i64, i64)>,
    Json(data): Json<MacroNodeForm>,
) -> Result<Json<MacroNodeResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let updated = Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        move |mut conn, scenario, study, project| {
            async move {
                let node = MacroNode::retrieve_or_fail(conn.clone(), node_id, || {
                    MacroNodeError::NotFound { node_id }
                })
                .await?;

                if project.id != project_id {
                    return Err::<_, InternalError>(ProjectError::NotFound { project_id }.into());
                }
                if study.id != study_id {
                    return Err(StudyError::NotFound { study_id }.into());
                }
                if scenario.id != scenario_id {
                    return Err(ScenarioError::NotFound { scenario_id }.into());
                }
                if node.scenario_id != scenario_id {
                    return Err(MacroNodeError::NotFound { node_id }.into());
                }

                let node = data
                    .into_macro_node_changeset(scenario_id)
                    .update_or_fail(&mut conn, node_id, || MacroNodeError::NotFound { node_id })
                    .await?;

                Ok(node)
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok(Json(MacroNodeResponse::from(updated)))
}

#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNodeIdParam),
    responses(
        (status = 204, description = "The macro node was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, node_id)): Path<(i64, i64, i64, i64)>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        move |mut conn, scenario, study, project| {
            async move {
                let node = MacroNode::retrieve_or_fail(conn.clone(), node_id, || {
                    MacroNodeError::NotFound { node_id }
                })
                .await?;

                if project.id != project_id {
                    return Err::<_, InternalError>(ProjectError::NotFound { project_id }.into());
                }
                if study.id != study_id {
                    return Err(StudyError::NotFound { study_id }.into());
                }
                if scenario.id != scenario_id {
                    return Err(ScenarioError::NotFound { scenario_id }.into());
                }
                if node.scenario_id != scenario_id {
                    return Err(MacroNodeError::NotFound { node_id }.into());
                }

                node.delete(&mut conn).await?;
                Ok(())
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn retrieve_macro_node_and_check_scenario(
    conn: DbConnection,
    scenario_id: i64,
    node_id: i64,
) -> Result<MacroNode> {
    let node =
        MacroNode::retrieve_or_fail(conn, node_id, || MacroNodeError::NotFound { node_id }).await?;
    if node.scenario_id != scenario_id {
        return Err(MacroNodeError::NotFound { node_id }.into());
    }
    Ok(node)
}

#[cfg(test)]
pub mod test {
    use pretty_assertions::assert_eq;
    use rand::Rng;
    use rand::distr::Alphanumeric;
    use rand::rng;

    use super::*;
    use crate::models::Project;
    use crate::models::Study;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::views::test_app::TestAppBuilder;

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

    impl PartialEq<MacroNodeResponse> for MacroNodeForm {
        fn eq(&self, other: &MacroNodeResponse) -> bool {
            self.position_x == other.position_x
                && self.position_y == other.position_y
                && self.full_name == other.full_name
                && self.connection_time == other.connection_time
                && self.labels == other.labels
                && self.trigram == other.trigram
                && self.path_item_key == other.path_item_key
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let nodes_data = vec![MacroNodeForm {
            position_x: 12,
            position_y: 51,
            full_name: Some("My super node".to_string()),
            connection_time: 13,
            labels: Tags::new(vec!["".to_string(), "".to_string()]),
            trigram: None,
            path_item_key: "->".to_string(),
        }];

        let request = app
            .post(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_nodes",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id
            ))
            .json(&MacroNodeBatchForm {
                macro_nodes: nodes_data.clone(),
            });
        let response: MacroNodeBatchResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let node = MacroNode::retrieve(db_pool.get_ok(), response.macro_nodes[0].id)
            .await
            .unwrap()
            .expect("Failed to retrieve node");

        assert_eq!(nodes_data, response.macro_nodes);
        assert_eq!(node, response.macro_nodes[0]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let node_data = MacroNodeForm {
            position_x: 4,
            position_y: 1,
            full_name: Some("My super node".to_string()),
            connection_time: 13,
            labels: Tags::new(vec!["A".to_string(), "B".to_string()]),
            trigram: None,
            path_item_key: "A->B".to_string(),
        };
        let request = app
            .put(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_nodes/{}",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id, fixtures.nodes[0].id
            ))
            .json(&node_data);
        let response: MacroNodeResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let node = MacroNode::retrieve(db_pool.get_ok(), fixtures.nodes[0].id)
            .await
            .unwrap()
            .expect("Failed to retrieve node");

        assert_eq!(node_data, response);
        assert_eq!(node, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_nodes/{}",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id, fixtures.nodes[0].id
        ));
        let response: MacroNodeResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert!(fixtures.nodes[0] == response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 10).await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_nodes?page=1&page_size=5",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id
        ));
        let response: MacroNodeListResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(10, response.stats.count);
        assert_eq!(5, response.results.len());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let request = app.delete(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_nodes/{}",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id, fixtures.nodes[0].id
        ));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let found = MacroNode::exists(&mut db_pool.get_ok(), fixtures.nodes[0].id)
            .await
            .unwrap();
        assert_eq!(false, found)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn retrieve_with_bad_scenario() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let result = retrieve_macro_node_and_check_scenario(
            db_pool.get_ok(),
            fixtures.scenario.id + 1,
            fixtures.nodes[0].id,
        )
        .await;

        assert!(result.is_err());
    }

    fn random_string(n: usize) -> String {
        rng()
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
        let mut rng = rand::rng();
        let fixtures = create_scenario_fixtures_set(conn, "test_scenario_name").await;

        let mut nodes: Vec<MacroNode> = Vec::new();
        for _ in 0..number {
            // Create node
            let node = MacroNode::changeset()
                .scenario_id(fixtures.scenario.id)
                .position_x(rng.random_range(0..100))
                .position_y(rng.random_range(0..100))
                .full_name(Some(random_string(10)))
                .connection_time(rng.random::<i64>())
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
