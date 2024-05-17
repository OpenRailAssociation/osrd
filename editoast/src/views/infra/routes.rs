use std::collections::HashMap;
use std::collections::HashSet;

use actix_web::get;
use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use chashmap::CHashMap;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

use crate::error::Result;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use crate::views::params::List;

use editoast_schemas::infra::DirectionalTrackRange;

crate::routes! {
    "/routes" => {
        get_routes_track_ranges,
        get_routes_from_waypoint,
        get_routes_nodes,
    }
}

#[derive(Debug, Display, Clone, Copy, Deserialize, ToSchema)]
enum WaypointType {
    Detector,
    BufferStop,
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
struct RoutesFromWaypointParams {
    /// Infra ID
    infra_id: i64,
    /// Type of the waypoint
    #[param(inline)]
    waypoint_type: WaypointType,
    /// Waypoint ID
    waypoint_id: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
struct RoutesResponse {
    starting: Vec<String>,
    ending: Vec<String>,
}

/// Retrieve all routes that starting and ending by the given waypoint (detector or buffer stop)
#[utoipa::path(
    tag = "infra,routes",
    params(RoutesFromWaypointParams),
    responses(
        (status = 200, body = inline(RoutesResponse), description = "All routes that starting and ending by the given waypoint")
    ),
)]
#[get("/{waypoint_type}/{waypoint_id}")]
async fn get_routes_from_waypoint(
    path: Path<RoutesFromWaypointParams>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<RoutesResponse>> {
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, path.infra_id, || InfraApiError::NotFound {
        infra_id: path.infra_id,
    })
    .await?;

    let routes = infra
        .get_routes_from_waypoint(conn, &path.waypoint_id, path.waypoint_type.to_string())
        .await?;

    // Split routes depending if they are entry or exit points
    let mut starting_routes = vec![];
    let mut ending_routes = vec![];
    routes.into_iter().for_each(|route| {
        if route.is_entry_point {
            starting_routes.push(route.route_id);
        } else {
            ending_routes.push(route.route_id);
        }
    });

    Ok(Json(RoutesResponse {
        starting: starting_routes,
        ending: ending_routes,
    }))
}

#[derive(Debug, Clone, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields, tag = "type", content = "track_ranges")]
enum RouteTrackRangesResult {
    Computed(Vec<DirectionalTrackRange>),
    NotFound,
    CantComputePath,
}

#[derive(Debug, Clone, Deserialize, utoipa::IntoParams)]
struct RouteTrackRangesParams {
    /// A list of comma-separated route ids
    #[param(value_type = String)]
    routes: List<String>,
}

#[derive(Default, Debug, Serialize, Deserialize, PartialEq, ToSchema)]
struct RoutesFromNodesPositions {
    /// List of route ids crossing a selection of nodes
    routes: Vec<String>,
    /// List of available positions for each node on the corresponding routes
    available_node_positions: HashMap<String, HashSet<String>>,
}

/// Compute the track ranges through which routes passes.
#[utoipa::path(
    tag = "infra,routes",
    params(InfraIdParam, RouteTrackRangesParams),
    responses(
        (status = 200, body = inline(Vec<RouteTrackRangesResult>), description = "Foreach route, all the track ranges in it or an error")
    ),
)]
#[get("/track_ranges")]
async fn get_routes_track_ranges<'a>(
    infra: Path<i64>,
    params: Query<RouteTrackRangesParams>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<Vec<RouteTrackRangesResult>>> {
    let infra_id = infra.into_inner();
    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;

    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let graph = Graph::load(&infra_cache);
    let routes_cache = infra_cache.routes();
    let result = params
        .routes
        .0
        .iter()
        .map(|route| {
            if let Some(route) = routes_cache.get(route) {
                let route = route.unwrap_route();
                let route_path = infra_cache.compute_track_ranges_on_route(route, &graph);
                if let Some(route_path) = route_path {
                    RouteTrackRangesResult::Computed(route_path.track_ranges)
                } else {
                    RouteTrackRangesResult::CantComputePath
                }
            } else {
                RouteTrackRangesResult::NotFound
            }
        })
        .collect::<Vec<_>>();

    Ok(Json(result))
}

/// Returns the list of routes crossing the specified nodes, along with the available positions for each of them.
#[utoipa::path(
    tag = "infra,routes",
    params(InfraIdParam),
    request_body(content = HashMap<String, Option<String>>, description = "A mapping node_id -> node_state | null"),
    responses(
        (status = 200, body = inline(RoutesFromNodesPositions), description = "A list of route IDs along with available positions for each specified node")
    ),
)]
#[post("/nodes")]
async fn get_routes_nodes(
    params: Path<InfraIdParam>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbConnectionPool>,
    Json(node_states): Json<HashMap<String, Option<String>>>,
) -> Result<Json<RoutesFromNodesPositions>> {
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, params.infra_id, || InfraApiError::NotFound {
        infra_id: params.infra_id,
    })
    .await?;

    if node_states.is_empty() {
        return Ok(Json(RoutesFromNodesPositions::default()));
    }

    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let routes_cache = infra_cache.routes();

    let filtered_routes = routes_cache
        .values()
        .map(|object_cache| object_cache.unwrap_route())
        // We're only interested in routes that depend on specific node positions
        .filter(|route| !route.switches_directions.is_empty())
        .filter(|route| {
            node_states.iter().all(|(node_id, node_state)| {
                match route.switches_directions.get(&node_id.as_str().into()) {
                    // The route crosses the requested node
                    Some(node_state_in_route) => {
                        if let Some(required_state) = node_state {
                            required_state == node_state_in_route.as_str()
                        } else {
                            true
                        }
                    }
                    // The route doesn't cross the requested node
                    None => false,
                }
            })
        })
        .collect::<Vec<_>>();

    let available_node_positions: HashMap<String, HashSet<String>> =
        filtered_routes
            .iter()
            .fold(HashMap::new(), |mut acc, route| {
                for (node_id, _) in node_states.iter() {
                    let node_direction = route
                        .switches_directions
                        .get(&node_id.clone().into())
                        .unwrap()
                        .to_string();

                    let current_node_positions = acc.entry(node_id.to_string()).or_default();
                    current_node_positions.insert(node_direction);
                }
                acc
            });

    let result = RoutesFromNodesPositions {
        routes: filtered_routes
            .iter()
            .map(|route| route.id.to_string())
            .collect(),
        available_node_positions,
    };

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::collections::HashMap;
    use std::collections::HashSet;

    use crate::assert_status_and_read;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::small_infra;
    use crate::infra_cache::operation::Operation;
    use crate::views::infra::routes::RoutesFromNodesPositions;
    use crate::views::infra::routes::RoutesResponse;
    use crate::views::infra::routes::WaypointType;
    use crate::views::tests::create_test_service;
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::infra::Waypoint;

    #[rstest]
    async fn get_routes_nodes() {
        let tests = vec![
            (json!({}), (vec![], vec![])),
            (
                json!({ "PA2": "A_B2" }), // point_switch
                (
                    vec!["rt.DA2->DA5", "rt.DA3->buffer_stop.0"],
                    vec![("PA2".to_string(), HashSet::from(["A_B2".to_string()]))],
                ),
            ),
            (
                json!({ "PD0": "STATIC" }), // crossing
                (
                    vec![
                        "rt.DD2->DD6",
                        "rt.DD4->DD0",
                        "rt.DD5->DE1",
                        "rt.DE0->buffer_stop.4",
                    ],
                    vec![("PD0".to_string(), HashSet::from(["STATIC".to_string()]))],
                ),
            ),
            (
                json!({ "PH0": "A1_B1" }), // double_slip_switch
                (
                    vec!["rt.DG0->DG3", "rt.DG1->DD7"],
                    vec![("PH0".to_string(), HashSet::from(["A1_B1".to_string()]))],
                ),
            ),
            (
                json!({ "PH1": null }), // all routes crossing PH1
                (
                    vec![
                        "rt.DG2->DH1",
                        "rt.DH2->DG4",
                        "rt.DH2->buffer_stop.7",
                        "rt.DH3->DH1",
                    ],
                    vec![(
                        "PH1".to_string(),
                        HashSet::from(["A_B1".to_string(), "A_B2".to_string()]),
                    )],
                ),
            ),
            (
                json!({ "PA0": "A_B1", "PA2": "A_B1" }),
                (
                    vec!["rt.DA0->DA5", "rt.DA3->buffer_stop.1"],
                    vec![
                        ("PA0".to_string(), HashSet::from(["A_B1".to_string()])),
                        ("PA2".to_string(), HashSet::from(["A_B1".to_string()])),
                    ],
                ),
            ),
            (
                json!({ "PA0": "A_B1", "PA2": null }),
                (
                    vec!["rt.DA0->DA5", "rt.DA3->buffer_stop.1"],
                    vec![
                        ("PA0".to_string(), HashSet::from(["A_B1".to_string()])),
                        ("PA2".to_string(), HashSet::from(["A_B1".to_string()])),
                    ],
                ),
            ),
        ];

        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;

        fn compare_result(got: RoutesFromNodesPositions, expected: RoutesFromNodesPositions) {
            let mut got_routes = got.routes;
            let mut expected_routes = expected.routes;
            got_routes.sort();
            expected_routes.sort();
            assert_eq!(got_routes, expected_routes);

            fn process_available_positions(
                positions: &HashMap<String, HashSet<String>>,
            ) -> Vec<(String, Vec<String>)> {
                let mut sorted_positions = positions
                    .iter()
                    .map(|(key, value)| {
                        let mut sorted_node_positions = Vec::from_iter(value.clone());
                        sorted_node_positions.sort();
                        (key.clone(), sorted_node_positions)
                    })
                    .collect::<Vec<_>>();
                sorted_positions.sort();
                sorted_positions
            }

            let got_available_positions: Vec<_> =
                process_available_positions(&got.available_node_positions);
            let expected_available_positions: Vec<_> =
                process_available_positions(&expected.available_node_positions);

            assert_eq!(got_available_positions, expected_available_positions);
        }

        for (params, expected) in tests {
            let expected_result = RoutesFromNodesPositions {
                routes: expected.0.iter().map(|s| s.to_string()).collect(),
                available_node_positions: expected.1.into_iter().collect::<HashMap<_, _>>(),
            };
            let request = TestRequest::post()
                .uri(&format!("/infra/{}/routes/nodes", small_infra.id()))
                .set_json(&params)
                .to_request();
            println!("{request:?}  body:\n    {params}");
            let response = call_service(&app, request).await;
            let got: RoutesFromNodesPositions = assert_status_and_read!(response, StatusCode::OK);
            compare_result(got, expected_result)
        }
    }

    #[rstest]
    async fn get_routes_should_return_routes_from_buffer_stop_and_detector() {
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        let track = TrackSection {
            id: "track_001".into(),
            length: 1_000.0,
            ..Default::default()
        }
        .into();
        let detector = Detector {
            id: "detector_001".into(),
            track: "track_001".into(),
            position: 100.0,
            ..Default::default()
        }
        .into();
        let bs_start = BufferStop {
            id: "bs_start".into(),
            track: "track_001".into(),
            position: 0.0,
            ..Default::default()
        }
        .into();
        let bs_stop = BufferStop {
            id: "bs_stop".into(),
            track: "track_001".into(),
            position: 1_000.0,
            ..Default::default()
        }
        .into();
        let route_1 = Route {
            id: "D001->BS_STOP".into(),
            entry_point: Waypoint::new_detector("detector_001"),
            exit_point: Waypoint::new_buffer_stop("bs_stop"),
            ..Default::default()
        }
        .into();
        let route_2 = Route {
            id: "BS_START->D001".into(),
            entry_point: Waypoint::new_buffer_stop("bs_start"),
            exit_point: Waypoint::new_detector("detector_001"),
            ..Default::default()
        }
        .into();
        for obj in [track, detector, bs_start, bs_stop, route_1, route_2] {
            let create_operation = Operation::Create(Box::new(obj));
            let request = TestRequest::post()
                .uri(format!("/infra/{empty_infra_id}/").as_str())
                .set_json(json!([create_operation]))
                .to_request();
            let response = call_service(&app, request).await;
            assert_eq!(response.status(), StatusCode::OK);
        }

        // BufferStop Routes
        let waypoint_type = WaypointType::BufferStop;
        let request = TestRequest::get()
            .uri(format!("/infra/{empty_infra_id}/routes/{waypoint_type}/bs_stop").as_str())
            .to_request();
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);
        let routes: RoutesResponse = read_body_json(response).await;
        assert_eq!(
            routes,
            RoutesResponse {
                starting: vec![],
                ending: vec!["D001->BS_STOP".to_string()]
            }
        );

        // Detector Routes
        let waypoint_type = WaypointType::Detector;
        let request = TestRequest::get()
            .uri(format!("/infra/{empty_infra_id}/routes/{waypoint_type}/detector_001").as_str())
            .to_request();
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);
        let routes: RoutesResponse = read_body_json(response).await;
        assert_eq!(
            routes,
            RoutesResponse {
                starting: vec!["D001->BS_STOP".to_string()],
                ending: vec!["BS_START->D001".to_string()]
            }
        );
    }

    #[rstest]
    async fn get_routes_should_return_empty_response() {
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();
        let waypoint_type = WaypointType::Detector;
        let request = TestRequest::get()
            .uri(
                format!("/infra/{empty_infra_id}/routes/{waypoint_type}/NOT_EXISTING_WAYPOINT_ID")
                    .as_str(),
            )
            .to_request();
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);
        let routes: RoutesResponse = read_body_json(response).await;
        assert_eq!(
            routes,
            RoutesResponse {
                starting: vec![],
                ending: vec![]
            }
        );
    }
}
