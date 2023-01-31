use crate::error::Result;
use crate::infra::Infra;
use crate::infra_cache::{Graph, InfraCache};
use crate::schema::DirectionalTrackRange;
use crate::views::params::List;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{block, scope, Data, Json, Path, Query};
use chashmap::CHashMap;
use diesel::sql_types::{BigInt, Bool, Text};
use diesel::{sql_query, RunQueryDsl};
use serde_json::{json, Value as JsonValue};

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

/// Return the railjson list of a specific OSRD object
#[get("/{waypoint_type}/{waypoint}")]
async fn get_routes_from_waypoint(
    path: Path<(i64, WaypointType, String)>,
    db_pool: Data<DbPool>,
) -> Result<Json<JsonValue>> {
    let (infra, waypoint_type, waypoint) = path.into_inner();
    let routes: Vec<RouteFromWaypointResult> = block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        sql_query(include_str!("sql/get_routes_from_waypoint.sql"))
            .bind::<BigInt, _>(infra)
            .bind::<Text, _>(waypoint)
            .bind::<Text, _>(waypoint_type.to_string())
            .load(&mut conn)
    })
    .await
    .unwrap()?;

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

    Ok(Json(
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
    let infra = infra.into_inner();
    let result = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        let infra = Infra::retrieve(&mut conn, infra)?;
        let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
        let graph = Graph::load(&infra_cache);
        let routes_cache = infra_cache.routes();
        Ok(params
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
            .collect::<Vec<_>>())
    })
    .await
    .unwrap()?;
    Ok(Json(result))
}
