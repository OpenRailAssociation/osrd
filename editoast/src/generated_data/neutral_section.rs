use async_trait::async_trait;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};

use super::GeneratedData;
use crate::error::Result;
use crate::infra_cache::InfraCache;

pub struct NeutralSectionLayer;

#[async_trait]
impl GeneratedData for NeutralSectionLayer {
    fn table_name() -> &'static str {
        "osrd_infra_neutralsectionlayer"
    }

    async fn generate(conn: &mut PgConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_neutral_section_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn update(
        _conn: &mut PgConnection,
        _infra: i64,
        _operations: &[crate::schema::operation::OperationResult],
        _infra_cache: &crate::infra_cache::InfraCache,
    ) -> Result<()> {
        // TODO: we don't manage the update of the neutral_section layer for the moment
        Ok(())
    }
}
