use std::collections::HashMap;
use std::ops::DerefMut;

use common::geometry::GeoJsonPoint;
use database::DbConnection;
use database::tables::infra_layer_operational_point::dsl;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use itertools::Itertools;
use schemas::primitives::ObjectType;

use super::GeneratedData;
use super::utils::InvolvedObjects;
use crate::diesel::ExpressionMethods;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::operation::CacheOperation;

pub struct OperationalPointLayer;

impl GeneratedData for OperationalPointLayer {
    fn table_name() -> &'static str {
        "infra_layer_operational_point"
    }

    async fn generate(conn: &mut DbConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_operational_point_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn.write().await.deref_mut())
            .await?;
        Ok(())
    }

    async fn update(
        conn: &mut DbConnection,
        infra: i64,
        operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<()> {
        let involved_objects =
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::OperationalPoint);

        // Delete elements
        if !involved_objects.is_empty() {
            // We must delete both updated and deleted operational points because we can only insert them and not update
            let objs = involved_objects
                .deleted
                .iter()
                .chain(involved_objects.updated.iter());

            delete(
                dsl::infra_layer_operational_point
                    .filter(dsl::infra_id.eq(infra))
                    .filter(dsl::obj_id.eq_any(objs)),
            )
            .execute(conn.write().await.deref_mut())
            .await?;
        }

        // Insert elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_operational_point_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn.write().await.deref_mut())
                .await?;
        }
        Ok(())
    }
}

#[derive(QueryableByName)]
struct OperationalPoint {
    #[diesel(sql_type = Text)]
    obj_id: String,
    #[diesel(sql_type = Jsonb)]
    geo: diesel_json::Json<GeoJsonPoint>,
}

impl OperationalPointLayer {
    pub async fn get(
        conn: &mut DbConnection,
        infra_id: i64,
        ids: &[&str],
    ) -> Result<HashMap<String, Vec<GeoJsonPoint>>> {
        Ok(sql_query(
            "SELECT obj_id, ST_AsGeoJSON(ST_Transform(geographic, 4326))::jsonb AS geo
                FROM infra_layer_operational_point
                WHERE infra_id = $1 AND obj_id = ANY($2)
                ORDER BY obj_id, part_index",
        )
        .bind::<BigInt, _>(infra_id)
        .bind::<Array<Text>, _>(ids)
        .load::<OperationalPoint>(conn.write().await.deref_mut())
        .await?
        .into_iter()
        .map(|op| (op.obj_id, op.geo.0))
        .into_grouping_map()
        .collect())
    }
}
