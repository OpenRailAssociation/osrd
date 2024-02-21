use std::collections::HashMap;

use crate::{
    error::Result,
    infra_cache::{Graph, InfraCache},
    models::{Infra, Retrieve},
    schema::DirectionalTrackRange,
    views::{
        infra::{InfraApiError, InfraIdParam},
        params::List,
    },
    DbPool,
};
use actix_web::{
    get,
    web::{Data, Json, Path, Query},
};
use chashmap::CHashMap;
use diesel::{
    sql_query,
    sql_types::{BigInt, Bool, Text},
};
use diesel_async::RunQueryDsl;

use serde::{Deserialize, Serialize};
use strum_macros::Display;
use utoipa::ToSchema;

crate::routes! {
    "/routes" => {
        get_routes_track_ranges,
        get_routes_from_waypoint,
        get_routes_nodes,
    }
}

#[derive(QueryableByName)]
struct RouteFromWaypointResult {
    #[diesel(sql_type = Text)]
    route_id: String,
    #[diesel(sql_type = Bool)]
    is_entry_point: bool,
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
    db_pool: Data<DbPool>,
) -> Result<Json<RoutesResponse>> {
    let mut conn = db_pool.get().await?;
    let routes: Vec<RouteFromWaypointResult> =
        sql_query(include_str!("sql/get_routes_from_waypoint.sql"))
            .bind::<BigInt, _>(&path.infra_id)
            .bind::<Text, _>(&path.waypoint_id)
            .bind::<Text, _>(path.waypoint_type.to_string())
            .load(&mut conn)
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
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<RouteTrackRangesResult>>> {
    let infra_id = infra.into_inner();
    let infra = match Infra::retrieve(db_pool.clone(), infra_id).await? {
        Some(infra) => infra,
        None => return Err(InfraApiError::NotFound { infra_id }.into()),
    };
    let mut conn = db_pool.get().await?;

    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    let graph = Graph::load(&infra_cache);
    let routes_cache = infra_cache.routes();
    let result = params
        .routes
        .0
        .iter()
        .map(|route| {
            if let Some(route) = routes_cache.get(route) {
                let route = route.unwrap_route();
                let route_path = route.compute_track_ranges(&infra_cache, &graph);
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

/// Return all routes that depend on the position of the specified nodes
#[utoipa::path(
    tag = "infra,routes",
    params(InfraIdParam),
    request_body(content = HashMap<String, Option<String>>, description = "A mapping node_id -> node_state | null"),
    responses(
        (status = 200, body = inline(Vec<String>), description = "A list of routes IDs")
    ),
)]
#[get("/nodes")]
async fn get_routes_nodes(
    params: Path<InfraIdParam>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbPool>,
    Json(node_states): Json<HashMap<String, Option<String>>>,
) -> Result<Json<Vec<String>>> {
    let infra = match Infra::retrieve(db_pool.clone(), params.infra_id).await? {
        Some(infra) => infra,
        None => {
            return Err(InfraApiError::NotFound {
                infra_id: params.infra_id,
            }
            .into())
        }
    };

    if node_states.is_empty() {
        return Ok(Json(vec![]));
    }

    let mut conn = db_pool.get().await?;
    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    let routes_cache = infra_cache.routes();

    let result = routes_cache
        .iter()
        // We're only interested in routes that depend on specific node positions
        .filter(|(_, route)| !route.unwrap_route().switches_directions.is_empty())
        .filter(|(_, route)| {
            let route = route.unwrap_route();
            node_states.iter().all(|(node_id, node_state)| {
                match route.switches_directions.get(&node_id.clone().into()) {
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
        .map(|(route_id, _)| route_id.clone())
        .collect::<Vec<_>>();

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use crate::{
        assert_status_and_read,
        fixtures::tests::{db_pool, empty_infra, small_infra},
        schema::{operation::Operation, BufferStop, Detector, Route, TrackSection, Waypoint},
        views::{
            infra::routes::{RoutesResponse, WaypointType},
            tests::create_test_service,
        },
    };

    #[rstest]
    async fn get_routes_nodes() {
        let tests = vec![
            (json!({}), vec![]),
            (
                json!({ "PA2": "A_B2" }), // point_switch
                vec!["rt.DA2->DA5", "rt.DA3->buffer_stop.0"],
            ),
            (
                json!({ "PD0": "STATIC" }), // crossing
                vec![
                    "rt.DD2->DD6",
                    "rt.DD4->DD0",
                    "rt.DD5->DE1",
                    "rt.DE0->buffer_stop.4",
                ],
            ),
            (
                json!({ "PH0": "A1_B1" }), // double_slip_switch
                vec!["rt.DG0->DG3", "rt.DG1->DD7"],
            ),
            (
                json!({ "PH1": null }), // all routes crossing PH1
                vec![
                    "rt.DG2->DH1",
                    "rt.DH2->DG4",
                    "rt.DH2->buffer_stop.7",
                    "rt.DH3->DH1",
                ],
            ),
            (
                json!({ "PA0": "A_B1", "PA2": "A_B1" }),
                vec!["rt.DA0->DA5", "rt.DA3->buffer_stop.1"],
            ),
            (
                json!({ "PA0": "A_B1", "PA2": null }),
                vec!["rt.DA0->DA5", "rt.DA3->buffer_stop.1"],
            ),
        ];

        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;

        for (params, mut expected) in tests {
            let request = TestRequest::get()
                .uri(&format!("/infra/{}/routes/nodes", small_infra.id()))
                .set_json(&params)
                .to_request();
            println!("{request:?}  body:\n    {params}");
            let response = call_service(&app, request).await;
            let mut got: Vec<String> = assert_status_and_read!(response, StatusCode::OK);
            expected.sort();
            got.sort();
            assert_eq!(got, expected);
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
