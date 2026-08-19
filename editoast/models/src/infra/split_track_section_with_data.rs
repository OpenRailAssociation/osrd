use database::Db;
use schemas::infra::TrackSection;
use schemas::primitives::Identifier;
use serde::Deserialize;

use crate::infra;

#[derive(Debug, Clone, Deserialize, sqlx::FromRow)]
pub struct SplitTrackSectionWithData {
    pub obj_id: String,
    pub railjson: sqlx::types::Json<TrackSection>,
    pub left_geo: sqlx::types::Json<geos::geojson::Geometry>,
    pub right_geo: sqlx::types::Json<geos::geojson::Geometry>,
}

impl infra::Model {
    pub async fn get_split_track_section_with_data(
        &self,
        db: Db,
        track: Identifier,
        distance_fraction: f64,
    ) -> Result<Option<SplitTrackSectionWithData>, crate::Error> {
        Ok(sqlx::query_file_as!(
            SplitTrackSectionWithData,
            "src/infra/sql/get_split_track_section_with_data.sql",
            self.id,
            track.to_string(),
            distance_fraction
        )
        .fetch_optional(db.sqlx())
        .await?)
    }
}
