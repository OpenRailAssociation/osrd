use async_trait::async_trait;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt, Text};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use std::iter::Iterator;

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::diesel::ExpressionMethods;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::schema::ObjectType;
use crate::tables::infra_layer_psl_sign::dsl;

pub struct PSLSignLayer;

#[async_trait]
impl GeneratedData for PSLSignLayer {
    fn table_name() -> &'static str {
        "infra_layer_psl_sign"
    }

    async fn generate(conn: &mut PgConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_psl_sign_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[crate::schema::operation::OperationResult],
        infra_cache: &crate::infra_cache::InfraCache,
    ) -> Result<()> {
        let involved_objects =
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::SpeedSection);

        // Delete elements
        if !involved_objects.is_empty() {
            // We must delete both updated and deleted lpv panels because we can only insert them and not update
            let objs = involved_objects
                .deleted
                .iter()
                .chain(involved_objects.updated.iter());
            delete(
                dsl::infra_layer_psl_sign
                    .filter(dsl::infra_id.eq(infra))
                    .filter(dsl::obj_id.eq_any(objs)),
            )
            .execute(conn)
            .await?;
        }

        // Insert involved elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_psl_sign_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn)
                .await?;
        }
        Ok(())
    }
}
