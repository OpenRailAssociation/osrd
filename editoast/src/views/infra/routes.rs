use crate::api_error::{ApiError, ApiResult};
use crate::db_connection::DBConnection;
use diesel::sql_types::{Bool, Integer, Text};
use diesel::{sql_query, RunQueryDsl};
use rocket::serde::json::json;
use rocket::serde::json::Value as JsonValue;
use rocket::{http::Status, response::status::Custom};
use thiserror::Error;

/// Return the endpoints routes of this module
pub fn routes() -> Vec<rocket::Route> {
    routes![get_routes_from_waypoint]
}

#[derive(Debug, Error)]
enum GetRouteFromWaypointErrors {
    #[error("Wrong waypoint type provided '{0}'. Expected 'Detector' or 'BufferStop'")]
    WrongWaypointType(String),
}

impl ApiError for GetRouteFromWaypointErrors {
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
        return Err(GetRouteFromWaypointErrors::WrongWaypointType(waypoint_type).into());
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
