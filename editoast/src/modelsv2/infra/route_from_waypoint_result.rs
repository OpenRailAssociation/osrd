use diesel::sql_types::Bool;
use diesel::sql_types::Text;

#[derive(QueryableByName)]
pub struct RouteFromWaypointResult {
    #[diesel(sql_type = Text)]
    pub route_id: String,
    #[diesel(sql_type = Bool)]
    pub is_entry_point: bool,
}
