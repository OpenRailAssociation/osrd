use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Double;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use diesel::QueryableByName;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;
use editoast_schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use super::Infra;
use crate::error::Result;
use crate::models::get_geometry_layer_table;
use crate::models::get_table;

editoast_common::schemas! {
    ObjectQueryable,
}

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

    pub async fn get_ts_object_with_length(
        &self,
        conn: &mut DbConnection,
        obj_id: &str,
        length: f64,
    ) -> Result<ObjectQueryable> {
        let query = format!("
            SELECT DISTINCT ON (object_table.obj_id)
                object_table.obj_id as obj_id,
                object_table.data as railjson,
                ST_AsGeoJSON(ST_Transform(geographic, 4326))::jsonb as geographic
            FROM {} AS object_table
            LEFT JOIN {} AS geometry_table ON object_table.obj_id = geometry_table.obj_id AND object_table.infra_id = geometry_table.infra_id
            WHERE object_table.infra_id = $1
            AND object_table.obj_id = $2
            AND (data->'length')::integer >= $3
            ",
            get_table(&ObjectType::TrackSection),
            get_geometry_layer_table(&ObjectType::TrackSection).unwrap()
        );

        Ok(sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<Text, _>(obj_id)
            .bind::<Double, _>(length)
            .get_result::<ObjectQueryable>(conn.write().await.deref_mut())
            .await?)
    }

    pub async fn get_op_objects_by_trigram(
        &self,
        conn: &mut DbConnection,
        trigram: &str,
    ) -> Result<Vec<ObjectQueryable>> {
        let query = format!("
            SELECT DISTINCT ON (object_table.obj_id)
                object_table.obj_id as obj_id,
                object_table.data as railjson,
                ST_AsGeoJSON(ST_Transform(geographic, 4326))::jsonb as geographic
            FROM {} AS object_table
            LEFT JOIN {} AS geometry_table ON object_table.obj_id = geometry_table.obj_id AND object_table.infra_id = geometry_table.infra_id
            WHERE object_table.infra_id = $1
            AND (data->'extensions'->'sncf'->>'trigram')::text = $2",
            get_table(&ObjectType::OperationalPoint),
            get_geometry_layer_table(&ObjectType::OperationalPoint).unwrap(),
        );

        Ok(sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<Text, _>(trigram)
            .load::<ObjectQueryable>(conn.write().await.deref_mut())
            .await?)
    }

    pub async fn get_op_objects_by_uic(
        &self,
        conn: &mut DbConnection,
        uic: i64,
    ) -> Result<Vec<ObjectQueryable>> {
        let query = format!("
            SELECT DISTINCT ON (object_table.obj_id)
                object_table.obj_id as obj_id,
                object_table.data as railjson,
                ST_AsGeoJSON(ST_Transform(geographic, 4326))::jsonb as geographic
            FROM {} AS object_table
            LEFT JOIN {} AS geometry_table ON object_table.obj_id = geometry_table.obj_id AND object_table.infra_id = geometry_table.infra_id
            WHERE object_table.infra_id = $1
            AND (data->'extensions'->'identifier'->'uic')::integer = $2",
            get_table(&ObjectType::OperationalPoint),
            get_geometry_layer_table(&ObjectType::OperationalPoint).unwrap()
        );

        Ok(sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<BigInt, _>(uic)
            .load::<ObjectQueryable>(conn.write().await.deref_mut())
            .await?)
    }
}
