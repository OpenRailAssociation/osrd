use database::Db;

use crate::infra;

#[derive(sqlx::FromRow)]
pub struct RouteFromWaypointResult {
    pub route_id: String,
    pub is_entry_point: bool,
}

impl infra::Model {
    pub async fn get_routes_from_waypoint(
        &self,
        db: Db,
        waypoint_id: &String,
        waypoint_type: String,
    ) -> Result<Vec<RouteFromWaypointResult>, crate::Error> {
        Ok(sqlx::query_file_as!(
            RouteFromWaypointResult,
            "src/infra/sql/get_routes_from_waypoint.sql",
            self.id,
            waypoint_id,
            waypoint_type
        )
        .fetch_all(db.sqlx())
        .await?)
    }
}
