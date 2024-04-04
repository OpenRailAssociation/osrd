use async_trait::async_trait;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::AsyncPgConnection as PgConnection;
use diesel_async::RunQueryDsl;

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::error::Result;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::InfraCache;
use crate::schema::ObjectType;

pub struct SwitchLayer;

#[async_trait]
impl GeneratedData for SwitchLayer {
    fn table_name() -> &'static str {
        "infra_layer_switch"
    }

    async fn generate(conn: &mut PgConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_switch_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<()> {
        let involved_objects =
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::Switch);

        // Delete elements
        if !involved_objects.deleted.is_empty() {
            sql_query(format!(
                "DELETE FROM {} WHERE infra_id = $1 AND obj_id = ANY($2)",
                Self::table_name()
            ))
            .bind::<BigInt, _>(infra)
            .bind::<Array<Text>, _>(involved_objects.deleted.into_iter().collect::<Vec<_>>())
            .execute(conn)
            .await?;
        }

        // Update elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_update_switch_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn)
                .await?;
        }
        Ok(())
    }
}
