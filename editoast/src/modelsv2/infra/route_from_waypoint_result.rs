use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Bool;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;

use super::Infra;
use crate::error::Result;

#[derive(QueryableByName)]
pub struct RouteFromWaypointResult {
    #[diesel(sql_type = Text)]
    pub route_id: String,
    #[diesel(sql_type = Bool)]
    pub is_entry_point: bool,
}

impl Infra {
    pub async fn get_routes_from_waypoint(
        &self,
        conn: &mut DbConnection,
        waypoint_id: &String,
        waypoint_type: String,
    ) -> Result<Vec<RouteFromWaypointResult>> {
        let routes = sql_query(include_str!("sql/get_routes_from_waypoint.sql"))
            .bind::<BigInt, _>(self.id)
            .bind::<Text, _>(&waypoint_id)
            .bind::<Text, _>(waypoint_type)
            .load::<RouteFromWaypointResult>(conn.write().await.deref_mut())
            .await?;
        Ok(routes)
    }
}
