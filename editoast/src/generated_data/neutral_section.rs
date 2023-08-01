use diesel::sql_types::BigInt;
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::GeneratedData;
use crate::error::Result;
use crate::infra_cache::InfraCache;

pub struct NeutralSectionLayer;

impl GeneratedData for NeutralSectionLayer {
    fn table_name() -> &'static str {
        "osrd_infra_neutralsectionlayer"
    }

    fn generate(conn: &mut PgConnection, infra: i64, _infra_cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_neutral_section_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)?;
        Ok(())
    }

    fn update(
        _conn: &mut PgConnection,
        _infra: i64,
        _operations: &[crate::schema::operation::OperationResult],
        _infra_cache: &crate::infra_cache::InfraCache,
    ) -> Result<()> {
        // TODO: we don't manage the update of the neutral_section layer for the moment
        Ok(())
    }
}
