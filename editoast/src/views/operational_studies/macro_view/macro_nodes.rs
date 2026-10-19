use std::collections::HashMap;
use std::sync::Arc;

use authz::Role;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnectionPool;
use editoast_derive::EditoastError;
use itertools::Itertools as _;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::path::operational_point_cache::OperationalPointCache;
use models::macro_node::MacroNode;
use models::macro_node::OperationalPointReferenceNode;
use models::prelude::*;
use models::scenario::Scenario;
use models::tags::Tags;
use schemas::train_schedule::OperationalPointReference;

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
    #[from(models::Error, database::DatabaseError)]
    Database(models::Error),
}

impl From<models::scenario::Error> for MacroNodeError {
    fn from(e: models::scenario::Error) -> Self {
        match e {
            models::scenario::Error::NotFound { scenario_id } => {
                MacroNodeError::ScenarioNotFound { scenario_id }
            }
            models::scenario::Error::Database(e) => MacroNodeError::Database(e),
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
    short_name: Option<String>,
    node_location: OperationalPointReferenceNode,
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
            .short_name(self.short_name)
            .node_location(self.node_location)
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
    short_name: Option<String>,
    node_location: OperationalPointReferenceNode,
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
            short_name: node.short_name,
            node_location: node.node_location,
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
    State(db_pool): State<Arc<DbConnectionPool>>,
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
    State(db_pool): State<Arc<DbConnectionPool>>,
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

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize))]
pub(in crate::views) struct MatchMacroNodesForm {
    scenario_id: i64,
    operational_point_references: Vec<OperationalPointReference>,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct MatchMacroNodesResponse {
    related_operational_points: Vec<Option<MacroNodeResponse>>,
}

/// Take a list of operational point references and return for each of them the macro node
/// of the scenario referencing the same operational point, if any
///
/// References are resolved on the scenario infra: a reference matches a node referencing the
/// same operational point by id, domestic code or UIC. Nodes located by a track offset never
/// match. When several nodes match, the oldest one is returned.
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    request_body = MatchMacroNodesForm,
    responses(
        (status = 200, body = MatchMacroNodesResponse, description = "The macro node matching each node location"),
    )
)]
pub(in crate::views) async fn match_macro_nodes(
    State(db_pool): State<Arc<DbConnectionPool>>,
    Json(MatchMacroNodesForm {
        scenario_id,
        operational_point_references,
    }): Json<MatchMacroNodesForm>,
) -> Result<Json<MatchMacroNodesResponse>> {
    let mut conn = db_pool.get().await?;
    let scenario = Scenario::retrieve_or_fail(conn.clone(), scenario_id, || {
        MacroNodeError::ScenarioNotFound { scenario_id }
    })
    .await?;
    let settings = SelectionSettings::new()
        .filter(move || MacroNode::SCENARIO_ID.eq(scenario_id))
        .order_by(|| MacroNode::ID.asc());
    let nodes = MacroNode::list(&mut conn, settings)
        .await?
        .into_iter()
        .filter_map(|node| match &node.node_location {
            OperationalPointReferenceNode::OperationalPointReference { operational_point } => {
                Some((operational_point.clone(), node))
            }
            OperationalPointReferenceNode::TrackOffset(_) => None,
        })
        .collect_vec();

    // Resolve the operational points of both the requested references and the scenario nodes,
    // so that a node referencing an operational point by domestic code matches a reference
    // to the same operational point by id or UIC.
    let all_references = operational_point_references
        .iter()
        .chain(nodes.iter().map(|(reference, _)| reference))
        .cloned()
        .collect_vec();
    let op_cache = OperationalPointCache::load_from_operational_points(
        conn,
        scenario.infra_id,
        &all_references,
    )
    .await?;

    // Nodes are sorted by id: when several nodes match, the oldest one is kept
    let mut nodes_by_key = HashMap::new();
    for (reference, node) in nodes {
        nodes_by_key
            .entry(OperationalPointKey::new(&op_cache, reference))
            .or_insert(node);
    }

    Ok(Json(MatchMacroNodesResponse {
        related_operational_points: operational_point_references
            .into_iter()
            .map(|reference| {
                nodes_by_key
                    .get(&OperationalPointKey::new(&op_cache, reference))
                    .cloned()
                    .map(MacroNodeResponse::from)
            })
            .collect(),
    }))
}

/// Identifies the operational point a reference points to when it exists in the infra,
/// the reference itself otherwise
#[derive(PartialEq, Eq, Hash)]
enum OperationalPointKey {
    Id(String),
    Reference(OperationalPointReference),
}

impl OperationalPointKey {
    fn new(op_cache: &OperationalPointCache, reference: OperationalPointReference) -> Self {
        op_cache
            .get_op_ref_id(&reference)
            .map(Self::Id)
            .unwrap_or(Self::Reference(reference))
    }
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
    State(db_pool): State<Arc<DbConnectionPool>>,
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
    State(db_pool): State<Arc<DbConnectionPool>>,
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
    State(db_pool): State<Arc<DbConnectionPool>>,
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

    use schemas::infra::TrackOffset;
    use schemas::train_schedule::OperationalPointReference;

    use super::*;
    use crate::fixtures::create_project;
    use crate::fixtures::create_scenario;
    use crate::fixtures::create_scenario_fixtures_set;
    use crate::fixtures::create_small_infra;
    use crate::fixtures::create_study;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::views::test_app;

    impl PartialEq<MacroNodeResponse> for MacroNode {
        fn eq(&self, other: &MacroNodeResponse) -> bool {
            self.id == other.id
                && self.position_x == other.position_x
                && self.position_y == other.position_y
                && self.full_name == other.full_name
                && self.labels == other.labels
                && self.short_name == other.short_name
                && self.node_location == other.node_location
                && self.is_collapsed == other.is_collapsed
        }
    }

    impl PartialEq<MacroNodeResponse> for MacroNodeForm {
        fn eq(&self, other: &MacroNodeResponse) -> bool {
            self.position_x == other.position_x
                && self.position_y == other.position_y
                && self.full_name == other.full_name
                && self.labels == other.labels
                && self.short_name == other.short_name
                && self.node_location == other.node_location
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
            short_name: None,
            node_location: OperationalPointReferenceNode::OperationalPointReference {
                operational_point: OperationalPointReference::Id {
                    operational_point: "op".into(),
                },
            },
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
            short_name: None,
            node_location: OperationalPointReferenceNode::TrackOffset(TrackOffset::new(
                "track", 1000,
            )),
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn match_macro_nodes() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let conn = &mut db_pool.get_ok();
        let infra = create_small_infra(conn).await;
        let (timetable, _) = create_timetable_with_train_schedule_set(conn).await;
        let project = create_project(conn, "project").await;
        let study = create_study(conn, "study", project.id).await;
        let scenario = create_scenario(conn, "scenario", study.id, timetable.id, infra.id).await;
        let (other_timetable, _) = create_timetable_with_train_schedule_set(conn).await;
        let other_scenario = create_scenario(
            conn,
            "other_scenario",
            study.id,
            other_timetable.id,
            infra.id,
        )
        .await;

        let west_station_domestic = OperationalPointReference::Domestic {
            country_code: "FR".into(),
            main_code: "WS".into(),
            secondary_code: Some("BV".into()),
        };
        let west_station_uic = OperationalPointReference::Uic {
            uic: 8722,
            secondary_code: Some("BV".into()),
        };
        let mid_east_station_id = OperationalPointReference::Id {
            operational_point: "Mid_East_station".into(),
        };
        let unknown_op_id = OperationalPointReference::Id {
            operational_point: "unknown".into(),
        };
        let south_west_station_id = OperationalPointReference::Id {
            operational_point: "South_West_station".into(),
        };
        let op_location = |operational_point: &OperationalPointReference| {
            OperationalPointReferenceNode::OperationalPointReference {
                operational_point: operational_point.clone(),
            }
        };

        let mut nodes = Vec::new();
        for (scenario_id, location) in [
            (scenario.id, op_location(&west_station_domestic)),
            (scenario.id, op_location(&west_station_uic)),
            (scenario.id, op_location(&mid_east_station_id)),
            (scenario.id, op_location(&unknown_op_id)),
            // West_station part, never matched since it is a track offset
            (
                scenario.id,
                OperationalPointReferenceNode::TrackOffset(TrackOffset::new("TA1", 500_000)),
            ),
            (other_scenario.id, op_location(&south_west_station_id)),
        ] {
            let node = MacroNode::changeset()
                .scenario_id(scenario_id)
                .position_x(0)
                .position_y(0)
                .labels(Tags::default())
                .node_location(location)
                .create(conn)
                .await
                .expect("Failed to create macro node");
            nodes.push(node);
        }

        let operational_point_references = vec![
            OperationalPointReference::Id {
                operational_point: "West_station".into(),
            },
            west_station_uic,
            OperationalPointReference::Domestic {
                country_code: "FR".into(),
                main_code: "MES".into(),
                secondary_code: Some("BV".into()),
            },
            unknown_op_id,
            south_west_station_id,
        ];
        let response: MatchMacroNodesResponse = app
            .post("/macro_nodes/match")
            .json(&MatchMacroNodesForm {
                scenario_id: scenario.id,
                operational_point_references,
            })
            .await
            .assert_status(StatusCode::OK)
            .json();

        let matched_ids = response
            .related_operational_points
            .iter()
            .map(|node| node.as_ref().map(|node| node.id))
            .collect_vec();
        assert_eq!(
            matched_ids,
            [
                // Both West_station nodes match, the oldest is kept
                Some(nodes[0].id),
                Some(nodes[0].id),
                Some(nodes[2].id),
                // Not in the infra: only the exact same reference matches
                Some(nodes[3].id),
                // Only in another scenario
                None,
            ]
        );
        assert_eq!(
            &nodes[0],
            response.related_operational_points[0].as_ref().unwrap()
        );
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
                .short_name(Some(random_string(3)))
                .node_location(OperationalPointReferenceNode::TrackOffset(
                    TrackOffset::new(random_string(10), 0),
                ))
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
