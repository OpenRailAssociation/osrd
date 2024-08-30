use async_trait::async_trait;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::diesel::ExpressionMethods;
use crate::error::Result;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::InfraCache;
use editoast_models::tables::infra_layer_detector::dsl;
use editoast_models::DbConnection;
use editoast_schemas::primitives::ObjectType;

pub struct DetectorLayer;

#[async_trait]
impl GeneratedData for DetectorLayer {
    fn table_name() -> &'static str {
        "infra_layer_detector"
    }

    async fn generate(conn: &mut DbConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_detector_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
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
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::Detector);

        // Delete elements
        if !involved_objects.deleted.is_empty() {
            delete(
                dsl::infra_layer_detector
                    .filter(dsl::infra_id.eq(infra))
                    .filter(dsl::obj_id.eq_any(involved_objects.deleted)),
            )
            .execute(conn)
            .await?;
        }

        // Update elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_update_detector_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn)
                .await?;
        }
        Ok(())
    }
}
