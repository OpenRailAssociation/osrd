use crate::error::Result;
use crate::infra_cache::{Graph, InfraCache};
use crate::models::{Infra, Retrieve};
use crate::schema::DirectionalTrackRange;
use crate::views::infra::InfraApiError;
use crate::views::params::List;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{scope, Data, Json, Path, Query};
use chashmap::CHashMap;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Bool, Text};
use diesel_async::RunQueryDsl;

use serde::{Deserialize, Serialize};
use strum_macros::Display;

/// Return `/infra/<infra_id>/routes` routes
pub fn routes() -> impl HttpServiceFactory {
    scope("/routes").service((get_routes_track_ranges, get_routes_from_waypoint))
}

#[derive(QueryableByName)]
struct RouteFromWaypointResult {
    #[diesel(sql_type = Text)]
    route_id: String,
    #[diesel(sql_type = Bool)]
    is_entry_point: bool,
}

#[derive(Debug, Display, Clone, Copy, Deserialize)]
enum WaypointType {
    Detector,
    BufferStop,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct RoutesResponse {
    starting: Vec<String>,
    ending: Vec<String>,
}

/// Return the routes list of a specific waypoint
#[get("/{waypoint_type}/{waypoint_id}")]
async fn get_routes_from_waypoint(
    path: Path<(i64, WaypointType, String)>,
    db_pool: Data<DbPool>,
) -> Result<Json<RoutesResponse>> {
    let (infra, waypoint_type, waypoint_id) = path.into_inner();
    let mut conn = db_pool.get().await?;
    let routes: Vec<RouteFromWaypointResult> =
        sql_query(include_str!("sql/get_routes_from_waypoint.sql"))
            .bind::<BigInt, _>(infra)
            .bind::<Text, _>(waypoint_id)
            .bind::<Text, _>(waypoint_type.to_string())
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

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(deny_unknown_fields, tag = "type", content = "track_ranges")]
enum RouteTrackRangesResult {
    Computed(Vec<DirectionalTrackRange>),
    NotFound,
    CantComputePath,
}

#[derive(Debug, Clone, Deserialize)]
struct RouteTrackRangesParams {
    routes: List<String>,
}

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

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    use crate::{
        fixtures::tests::{db_pool, empty_infra},
        schema::{operation::Operation, BufferStop, Detector, Route, TrackSection, Waypoint},
        views::{
            infra::routes::{RoutesResponse, WaypointType},
            tests::create_test_service,
        },
    };

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
