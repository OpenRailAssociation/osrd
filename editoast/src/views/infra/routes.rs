use std::sync::Arc;

use crate::api_error::{ApiError, ApiResult};
use crate::db_connection::DBConnection;
use crate::infra::Infra;
use crate::infra_cache::{Graph, InfraCache};
use crate::schema::DirectionalTrackRange;
use crate::views::params::List;
use chashmap::CHashMap;
use diesel::sql_types::{Bool, Integer, Text};
use diesel::{sql_query, RunQueryDsl};
use rocket::serde::json::Value as JsonValue;
use rocket::serde::json::{json, Json};
use rocket::State;
use rocket::{http::Status, response::status::Custom};

use serde::Serialize;
use thiserror::Error;

/// Return the endpoints routes of this module
pub fn routes() -> Vec<rocket::Route> {
    routes![get_routes_from_waypoint, get_routes_track_ranges]
}

#[derive(Debug, Error)]
enum RouteViewErrors {
    #[error("Wrong waypoint type provided '{0}'. Expected 'Detector' or 'BufferStop'")]
    WrongWaypointType(String),
}

impl ApiError for RouteViewErrors {
    fn get_status(&self) -> Status {
        Status::BadRequest
    }

    fn get_type(&self) -> &'static str {
        match self {
            Self::WrongWaypointType(_) => "editoast:infra:routes:WrongWaypointType",
        }
    }
}

#[derive(QueryableByName)]
struct RouteFromWaypointResult {
    #[diesel(sql_type = Text)]
    route_id: String,
    #[diesel(sql_type = Bool)]
    is_entry_point: bool,
}

/// Return the railjson list of a specific OSRD object
#[get("/<infra>/routes/<waypoint_type>/<waypoint>")]
async fn get_routes_from_waypoint(
    infra: i32,
    waypoint_type: String,
    waypoint: String,
    conn: DBConnection,
) -> ApiResult<Custom<JsonValue>> {
    if waypoint_type != "Detector" && waypoint_type != "BufferStop" {
        return Err(RouteViewErrors::WrongWaypointType(waypoint_type).into());
    }
    let routes: Vec<RouteFromWaypointResult> = conn
        .run(move |conn| {
            sql_query(include_str!("sql/get_routes_from_waypoint.sql"))
                .bind::<Integer, _>(infra)
                .bind::<Text, _>(waypoint)
                .bind::<Text, _>(waypoint_type)
                .load(conn)
        })
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

    Ok(Custom(
        Status::Ok,
        json!({"starting": starting_routes, "ending": ending_routes}),
    ))
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(deny_unknown_fields, tag = "type", content = "track_ranges")]
enum RouteTrackRangesResult {
    Computed(Vec<DirectionalTrackRange>),
    NotFound,
    CantComputePath,
}

#[get("/<infra>/routes/track_ranges?<routes>")]
async fn get_routes_track_ranges<'a>(
    infra: i32,
    routes: List<'a, String>,
    infra_caches: &State<Arc<CHashMap<i32, InfraCache>>>,
    conn: DBConnection,
) -> ApiResult<Custom<Json<Vec<RouteTrackRangesResult>>>> {
    let infra_caches = infra_caches.inner().clone();
    let result = conn
        .run::<_, ApiResult<_>>(move |conn| {
            let infra = Infra::retrieve(conn, infra)?;
            let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra)?;
            let graph = Graph::load(&infra_cache);
            let routes_cache = infra_cache.routes();
            Ok(routes
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
                .collect::<Vec<_>>())
        })
        .await?;
    Ok(Custom(Status::Ok, result.into()))
}
