use async_trait::async_trait;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt, Text};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::diesel::ExpressionMethods;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::schema::ObjectType;
use crate::tables::infra_layer_operational_point::dsl as layer_dsl;
use crate::tables::search_operational_point::dsl as search_dsl;

pub struct OperationalPointLayer;

#[async_trait]
impl GeneratedData for OperationalPointLayer {
    fn table_name() -> &'static str {
        "infra_layer_operational_point"
    }

    async fn clear(conn: &mut PgConnection, infra: i64) -> Result<()> {
        use diesel_async::RunQueryDsl;
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::table_name()
        ))
        .bind::<BigInt, _>(infra)
        .execute(conn)
        .await?;
        sql_query("DELETE FROM search_operational_point WHERE infra_id = $1")
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn generate(conn: &mut PgConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_operational_point_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        sql_query(include_str!("sql/generate_search_operational_point.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;

        Ok(())
    }

    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[crate::schema::operation::CacheOperation],
        infra_cache: &crate::infra_cache::InfraCache,
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
                layer_dsl::infra_layer_operational_point
                    .filter(layer_dsl::infra_id.eq(infra))
                    .filter(layer_dsl::obj_id.eq_any(objs.clone())),
            )
            .execute(conn)
            .await?;
            delete(
                search_dsl::search_operational_point
                    .filter(search_dsl::infra_id.eq(infra as i32))
                    .filter(search_dsl::obj_id.eq_any(objs)),
            )
            .execute(conn)
            .await?;
        }

        // Insert elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_operational_point_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(
                    involved_objects
                        .clone()
                        .updated
                        .into_iter()
                        .collect::<Vec<_>>(),
                )
                .execute(conn)
                .await?;
            sql_query(include_str!(
                "sql/insert_update_search_operational_point.sql"
            ))
            .bind::<BigInt, _>(infra)
            .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
            .execute(conn)
            .await?;
        }
        Ok(())
    }
}
