use std::sync::Arc;

use authz::Role;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use editoast_models::macro_node::MacroNode;
use editoast_models::prelude::*;
use editoast_models::scenario::Scenario;
use editoast_models::tags::Tags;

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "macro_node")]
enum MacroNodeError {
    #[error("Scenario '{scenario_id}', could not be found")]
    #[editoast_error(status = 404)]
    ScenarioNotFound { scenario_id: i64 },

    #[error("Node '{node_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { node_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(editoast_models::Error, database::DatabaseError)]
    Database(editoast_models::Error),
}

impl From<editoast_models::scenario::Error> for MacroNodeError {
    fn from(e: editoast_models::scenario::Error) -> Self {
        match e {
            editoast_models::scenario::Error::NotFound { scenario_id } => {
                MacroNodeError::ScenarioNotFound { scenario_id }
            }
            editoast_models::scenario::Error::Database(e) => MacroNodeError::Database(e),
        }
    }
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct MacroNodeIdParam {
    node_id: i64,
}

#[derive(Debug, Deserialize, ToSchema, Clone)]
#[cfg_attr(test, derive(Serialize, PartialEq))]
pub(in crate::views) struct MacroNodeForm {
    position_x: i64,
    position_y: i64,
    full_name: Option<String>,
    labels: Tags,
    trigram: Option<String>,
    path_item_key: String,
    #[serde(default)]
    is_collapsed: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize, PartialEq))]
pub(in crate::views) struct MacroNodeBatchForm {
    macro_nodes: Vec<MacroNodeForm>,
    scenario_id: i64,
}

impl MacroNodeForm {
    pub fn into_macro_node_changeset(self, scenario_id: i64) -> Changeset<MacroNode> {
        MacroNode::changeset()
            .scenario_id(scenario_id)
            .position_x(self.position_x)
            .position_y(self.position_y)
            .full_name(self.full_name)
            .labels(self.labels)
            .trigram(self.trigram)
            .path_item_key(self.path_item_key)
            .is_collapsed(self.is_collapsed)
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct MacroNodeResponse {
    id: i64,
    position_x: i64,
    position_y: i64,
    full_name: Option<String>,
    labels: Tags,
    trigram: Option<String>,
    path_item_key: String,
    is_collapsed: bool,
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
            labels: node.labels,
            trigram: node.trigram,
            path_item_key: node.path_item_key,
            is_collapsed: node.is_collapsed,
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

#[derive(IntoParams, Deserialize)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ListMacroNodesQueryParams {
    #[param(inline)]
    scenario_id: i64,
}

/// Get macro node list by scenario id
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ListMacroNodesQueryParams, PaginationQueryParams<100>),
    responses(
        (status = 200, body = MacroNodeListResponse, description = "List of macro nodes for the requested scenario"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Query(ListMacroNodesQueryParams { scenario_id }): Query<ListMacroNodesQueryParams>,
    Query(pagination_params): Query<PaginationQueryParams<100>>,
) -> Result<Json<MacroNodeListResponse>> {
    // Checking role
    let mut conn = db_pool.get().await?;

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

/// Create macro nodes in batch
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    request_body = MacroNodeBatchForm,
    responses(
        (status = 201, body = MacroNodeBatchResponse, description = "Macro nodes created"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(MacroNodeBatchForm {
        macro_nodes,
        scenario_id,
    }): Json<MacroNodeBatchForm>,
) -> Result<impl IntoResponse> {
    // Checking role
    let created = Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        async move |mut conn, _scenario, _study, _project| {
            let changesets: Vec<_> = macro_nodes
                .into_iter()
                .map(|node| node.into_macro_node_changeset(scenario_id))
                .collect();

            let macro_nodes: Vec<_> = MacroNode::create_batch(&mut conn, changesets).await?;

            Ok::<_, MacroNodeError>(macro_nodes)
        },
    )
    .await
    .map_err(MacroNodeError::from)??;

    Ok((
        StatusCode::CREATED,
        Json(MacroNodeBatchResponse {
            macro_nodes: created.into_iter().map_into().collect(),
        }),
    ))
}

/// Retrieve a macro node by id
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(MacroNodeIdParam),
    responses(
        (status = 200, body = MacroNodeResponse, description = "The requested Macro node"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(MacroNodeIdParam { node_id }): Path<MacroNodeIdParam>,
) -> Result<Json<MacroNodeResponse>> {
    // Checking role
    let conn = db_pool.get().await?;

    // Get the node
    let macro_node =
        MacroNode::retrieve_or_fail(conn, node_id, || MacroNodeError::NotFound { node_id }).await?;

    Ok(Json(MacroNodeResponse::from(macro_node)))
}

/// Update a macro node
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    put, path = "",
    tag = "scenarios",
    params(MacroNodeIdParam),
    request_body = MacroNodeForm,
    responses(
        (status = 200, body = MacroNodeResponse, description = "The updated macro node"),
    )
)]
pub(in crate::views) async fn update(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(MacroNodeIdParam { node_id }): Path<MacroNodeIdParam>,
    Json(data): Json<MacroNodeForm>,
) -> Result<Json<MacroNodeResponse>> {
    let conn = db_pool.get().await?;

    let updated_macro_node = conn
        .transaction(async move |conn| {
            let node = MacroNode::retrieve_or_fail(conn.clone(), node_id, || {
                MacroNodeError::NotFound { node_id }
            })
            .await?;

            let updated_macro_node = Scenario::transactional_content_update(
                conn,
                node.scenario_id,
                async move |mut conn, scenario, _study, _project| {
                    let node = data
                        .into_macro_node_changeset(scenario.id)
                        .update_or_fail(&mut conn, node_id, || MacroNodeError::NotFound { node_id })
                        .await?;

                    Ok::<_, MacroNodeError>(node)
                },
            )
            .await
            .map_err(MacroNodeError::from)??;

            Ok::<_, MacroNodeError>(updated_macro_node)
        })
        .await?;

    Ok(Json(MacroNodeResponse::from(updated_macro_node)))
}

/// Delete a macro node
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "scenarios",
    params(MacroNodeIdParam),
    responses(
        (status = 204, description = "The macro node was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(MacroNodeIdParam { node_id }): Path<MacroNodeIdParam>,
) -> Result<impl IntoResponse> {
    let conn = db_pool.get().await?;

    conn.transaction(async move |conn| {
        let node = MacroNode::retrieve_or_fail(conn.clone(), node_id, || {
            MacroNodeError::NotFound { node_id }
        })
        .await?;

        Scenario::transactional_content_update(
            conn,
            node.scenario_id,
            async move |mut conn, _scenario, _study, _project| {
                node.delete(&mut conn).await?;
                Ok::<_, MacroNodeError>(())
            },
        )
        .await
        .map_err(MacroNodeError::from)??;

        Ok::<_, MacroNodeError>(())
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
pub mod test {
    use pretty_assertions::assert_eq;
    use rand::RngExt as _;
    use rand::distr::Alphanumeric;
    use rand::rng;

    use super::*;
    use crate::fixtures::create_scenario_fixtures_set;
    use crate::views::test_app;

    impl PartialEq<MacroNodeResponse> for MacroNode {
        fn eq(&self, other: &MacroNodeResponse) -> bool {
            self.id == other.id
                && self.position_x == other.position_x
                && self.position_y == other.position_y
                && self.full_name == other.full_name
                && self.labels == other.labels
                && self.trigram == other.trigram
                && self.path_item_key == other.path_item_key
                && self.is_collapsed == other.is_collapsed
        }
    }

    impl PartialEq<MacroNodeResponse> for MacroNodeForm {
        fn eq(&self, other: &MacroNodeResponse) -> bool {
            self.position_x == other.position_x
                && self.position_y == other.position_y
                && self.full_name == other.full_name
                && self.labels == other.labels
                && self.trigram == other.trigram
                && self.path_item_key == other.path_item_key
                && self.is_collapsed == other.is_collapsed
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let nodes_data = vec![MacroNodeForm {
            position_x: 12,
            position_y: 51,
            full_name: Some("My super node".to_string()),
            labels: Tags::new(vec!["".to_string(), "".to_string()]),
            trigram: None,
            path_item_key: "->".to_string(),
            is_collapsed: false,
        }];

        let response: MacroNodeBatchResponse = app
            .post("/macro_nodes")
            .json(&MacroNodeBatchForm {
                macro_nodes: nodes_data.clone(),
                scenario_id: fixtures.scenario.id,
            })
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        let node = MacroNode::retrieve(db_pool.get_ok(), response.macro_nodes[0].id)
            .await
            .unwrap()
            .expect("Failed to retrieve node");

        assert_eq!(nodes_data, response.macro_nodes);
        assert_eq!(node, response.macro_nodes[0]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let node_data = MacroNodeForm {
            position_x: 4,
            position_y: 1,
            full_name: Some("My super node".to_string()),
            labels: Tags::new(vec!["A".to_string(), "B".to_string()]),
            trigram: None,
            path_item_key: "A->B".to_string(),
            is_collapsed: false,
        };
        let response: MacroNodeResponse = app
            .put(&format!("/macro_nodes/{}", fixtures.nodes[0].id))
            .json(&node_data)
            .await
            .assert_status_ok()
            .json();

        let node = MacroNode::retrieve(db_pool.get_ok(), fixtures.nodes[0].id)
            .await
            .unwrap()
            .expect("Failed to retrieve node");

        assert_eq!(node_data, response);
        assert_eq!(node, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        let response: MacroNodeResponse = app
            .get(&format!("/macro_nodes/{}", fixtures.nodes[0].id))
            .await
            .assert_status_ok()
            .json();

        assert!(fixtures.nodes[0] == response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_node_not_found() {
        let app = test_app!().skip_authz().build();

        app.get("/macro_nodes/999999")
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 10).await;

        let response: MacroNodeListResponse = app
            .get(&format!(
                "/macro_nodes?page=1&page_size=5&scenario_id={}",
                fixtures.scenario.id
            ))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(10, response.stats.count);
        assert_eq!(5, response.results.len());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let fixtures = create_macro_node_fixtures_set(&mut db_pool.get_ok(), 1).await;

        app.delete(&format!("/macro_nodes/{}", fixtures.nodes[0].id))
            .await
            .assert_status_no_content();

        let found = MacroNode::exists(&mut db_pool.get_ok(), fixtures.nodes[0].id)
            .await
            .unwrap();
        assert_eq!(false, found)
    }

    fn random_string(n: usize) -> String {
        rng()
            .sample_iter(&Alphanumeric)
            .take(n)
            .map(char::from)
            .collect()
    }

    struct MacroNodeFixtureSet {
        scenario: Scenario,
        nodes: Vec<MacroNode>,
    }

    async fn create_macro_node_fixtures_set(
        conn: &mut database::DbConnection,
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
                .labels(Tags::new(vec![random_string(5), random_string(5)]))
                .trigram(Some(random_string(3)))
                .path_item_key(random_string(10))
                .create(conn)
                .await
                .expect("Failed to create macro node");

            nodes.push(node)
        }

        MacroNodeFixtureSet {
            scenario: fixtures.scenario,
            nodes,
        }
    }
}
