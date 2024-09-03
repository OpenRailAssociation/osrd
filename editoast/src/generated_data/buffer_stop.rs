use std::ops::DerefMut;

use async_trait::async_trait;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_models::tables::infra_layer_buffer_stop::dsl;
use editoast_models::DbConnection;
use editoast_schemas::primitives::ObjectType;

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::diesel::ExpressionMethods;
use crate::error::Result;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::InfraCache;

pub struct BufferStopLayer;

#[async_trait]
impl GeneratedData for BufferStopLayer {
    fn table_name() -> &'static str {
        "infra_layer_buffer_stop"
    }

    async fn generate(conn: &DbConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        let _res = sql_query(include_str!("sql/generate_buffer_stop_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn.write().await.deref_mut())
            .await?;
        Ok(())
    }

    async fn update(
        conn: &DbConnection,
        infra: i64,
        operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<()> {
        let involved_objects =
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::BufferStop);

        // Delete elements
        if !involved_objects.deleted.is_empty() {
            delete(
                dsl::infra_layer_buffer_stop
                    .filter(dsl::infra_id.eq(infra))
                    .filter(dsl::obj_id.eq_any(involved_objects.deleted)),
            )
            .execute(conn.write().await.deref_mut())
            .await?;
        }

        // Update elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_update_buffer_stop_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn.write().await.deref_mut())
                .await?;
        }
        Ok(())
    }
}
