use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use editoast_schemas::infra::TrackSection;
use serde::Deserialize;

#[derive(QueryableByName, Debug, Clone, Deserialize)]
pub struct SplitedTrackSectionWithData {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[diesel(sql_type = Jsonb)]
    pub railjson: diesel_json::Json<TrackSection>,
    #[diesel(sql_type = Jsonb)]
    pub left_geo: diesel_json::Json<geos::geojson::Geometry>,
    #[diesel(sql_type = Jsonb)]
    pub right_geo: diesel_json::Json<geos::geojson::Geometry>,
}
