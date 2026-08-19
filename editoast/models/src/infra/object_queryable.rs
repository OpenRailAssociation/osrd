use common::geometry::GeoJson;
use database::Db;
use schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use crate::infra;
use crate::infra_objects::get_geometry_layer_table;
use crate::infra_objects::get_table;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
#[schema(as = InfraObjectWithGeometry)]
pub struct ObjectQueryable {
    pub obj_id: String,
    #[schema(value_type = Object)]
    pub railjson: serde_json::Value,
    #[schema(value_type = GeoJson)]
    pub geographic: Option<serde_json::Value>,
}

impl infra::Model {
    pub async fn get_objects(
        &self,
        db: Db,
        object_type: ObjectType,
        object_ids: &Vec<String>,
    ) -> Result<Vec<ObjectQueryable>, crate::Error> {
        // Prepare query
        let query = if [ObjectType::SwitchType, ObjectType::Route].contains(&object_type) {
            format!(
                "SELECT obj_id as obj_id, data as railjson, NULL::jsonb as geographic
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
        Ok(
            sqlx::query_as::<_, ObjectQueryable>(sqlx::AssertSqlSafe(query))
                .bind(self.id)
                .bind(object_ids)
                .fetch_all(db.sqlx())
                .await?,
        )
    }

    pub async fn list_objects(
        &self,
        db: Db,
        object_type: ObjectType,
    ) -> Result<Vec<String>, crate::Error> {
        let query = format!(
            "SELECT obj_id FROM {} WHERE infra_id = $1",
            get_table(&object_type)
        );
        Ok(sqlx::query_scalar(sqlx::AssertSqlSafe(query))
            .bind(self.id)
            .fetch_all(db.sqlx())
            .await?)
    }
}
