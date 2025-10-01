use std::ops::DerefMut;

use common::geometry::GeoJson;
use database::DbConnection;
use diesel::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use super::Infra;
use crate::error::Result;
use crate::models::get_geometry_layer_table;
use crate::models::get_table;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, QueryableByName, utoipa::ToSchema)]
#[schema(as = InfraObjectWithGeometry)]
pub struct ObjectQueryable {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[diesel(sql_type = Jsonb)]
    #[schema(value_type = Object)]
    pub railjson: serde_json::Value,
    #[diesel(sql_type = Nullable<Jsonb>)]
    #[schema(value_type = GeoJson)]
    pub geographic: Option<diesel_json::Json<geos::geojson::Geometry>>,
}

impl Infra {
    pub async fn get_objects(
        &self,
        conn: &mut DbConnection,
        object_type: ObjectType,
        object_ids: &Vec<String>,
    ) -> Result<Vec<ObjectQueryable>> {
        // Prepare query
        let query = if [ObjectType::SwitchType, ObjectType::Route].contains(&object_type) {
            format!(
                "SELECT obj_id as obj_id, data as railjson, NULL as geographic
                FROM {} WHERE infra_id = $1 AND obj_id = ANY($2)",
                get_table(&object_type)
            )
        } else {
            format!("
            SELECT DISTINCT ON (object_table.obj_id)
                object_table.obj_id as obj_id,
                object_table.data as railjson,
                ST_AsGeoJSON(ST_Transform(geographic, 4326))::jsonb as geographic
            FROM {} AS object_table
            LEFT JOIN {} AS geometry_table ON object_table.obj_id = geometry_table.obj_id AND object_table.infra_id = geometry_table.infra_id
            WHERE object_table.infra_id = $1 AND object_table.obj_id = ANY($2)
            ",
            get_table(&object_type),
            get_geometry_layer_table(&object_type).unwrap()
        )
        };

        // Execute query
        let objects = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<Array<Text>, _>(object_ids)
            .load::<ObjectQueryable>(conn.write().await.deref_mut())
            .await?;
        Ok(objects)
    }

    pub async fn list_objects(
        &self,
        conn: &mut DbConnection,
        object_type: ObjectType,
    ) -> Result<Vec<String>> {
        let query = format!(
            "SELECT obj_id FROM {} WHERE infra_id = $1",
            get_table(&object_type)
        );

        #[derive(QueryableByName)]
        struct ObjectId {
            #[diesel(sql_type = Text)]
            obj_id: String,
        }

        let objects = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .load::<ObjectId>(conn.write().await.deref_mut())
            .await?
            .into_iter()
            .map(|e| e.obj_id)
            .collect();
        Ok(objects)
    }
}
