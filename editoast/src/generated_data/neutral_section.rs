use async_trait::async_trait;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel_async::RunQueryDsl;

use super::GeneratedData;
use crate::error::Result;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::InfraCache;
use crate::modelsv2::Connection;

pub struct NeutralSectionLayer;

#[async_trait]
impl GeneratedData for NeutralSectionLayer {
    fn table_name() -> &'static str {
        "infra_layer_neutral_section"
    }

    async fn generate(conn: &mut Connection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_neutral_section_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn update(
        _conn: &mut Connection,
        _infra: i64,
        _operations: &[CacheOperation],
        _infra_cache: &InfraCache,
    ) -> Result<()> {
        // TODO: we don't manage the update of the neutral_section layer for the moment
        Ok(())
    }
}
