use std::ops::DerefMut;

use database::DbConnection;
use diesel::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Jsonb};
use diesel_async::RunQueryDsl;

use super::Infra;

#[derive(Debug, QueryableByName)]
pub struct BoundingBox {
    #[diesel(sql_type = Jsonb)]
    pub geo: diesel_json::Json<geos::geojson::Geometry>,
}

impl Infra {
    pub async fn get_bounding_box(
        &self,
        conn: &mut DbConnection,
    ) -> Result<Option<geos::geojson::Geometry>, database::DatabaseError> {
        Ok(sql_query(
            "SELECT
                ST_Transform(
                    ST_SetSRID(
                        ST_Extent(geographic),
                        3857
                    ),
                    4326
                )::jsonb as geo
            FROM infra_layer_track_section
            WHERE infra_id = $1;",
        )
        .bind::<BigInt, _>(self.id)
        .get_result::<Option<BoundingBox>>(conn.write().await.deref_mut())
        .await?
        .map(|bbox| bbox.geo.0))
    }
}
