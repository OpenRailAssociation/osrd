use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Double;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel::OptionalExtension;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;
use editoast_schemas::infra::TrackSection;
use editoast_schemas::primitives::Identifier;
use serde::Deserialize;

use super::Infra;
use crate::error::Result;

#[derive(QueryableByName, Debug, Clone, Deserialize)]
pub struct SplitTrackSectionWithData {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[diesel(sql_type = Jsonb)]
    pub railjson: diesel_json::Json<TrackSection>,
    #[diesel(sql_type = Jsonb)]
    pub left_geo: diesel_json::Json<geos::geojson::Geometry>,
    #[diesel(sql_type = Jsonb)]
    pub right_geo: diesel_json::Json<geos::geojson::Geometry>,
}

impl Infra {
    pub async fn get_split_track_section_with_data(
        &self,
        conn: &mut DbConnection,
        track: Identifier,
        distance_fraction: f64,
    ) -> Result<Option<SplitTrackSectionWithData>> {
        let query = include_str!("sql/get_split_track_section_with_data.sql");
        let result = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<Text, _>(track.to_string())
            .bind::<Double, _>(distance_fraction)
            .get_result::<SplitTrackSectionWithData>(conn.write().await.deref_mut())
            .await
            .optional()?;
        Ok(result)
    }
}
