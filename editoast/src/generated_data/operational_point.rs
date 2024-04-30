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
use crate::modelsv2::Connection;
use crate::tables::infra_layer_operational_point::dsl;
use editoast_schemas::primitives::ObjectType;

pub struct OperationalPointLayer;

#[async_trait]
impl GeneratedData for OperationalPointLayer {
    fn table_name() -> &'static str {
        "infra_layer_operational_point"
    }

    async fn generate(conn: &mut Connection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_operational_point_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn update(
        conn: &mut Connection,
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
            .execute(conn)
            .await?;
        }

        // Insert elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_operational_point_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn)
                .await?;
        }
        Ok(())
    }
}
