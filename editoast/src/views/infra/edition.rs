use diesel::PgConnection;

use crate::api_error::{ApiResult, InfraLockedError};
use crate::chartos::InvalidationZone;
use crate::generated_data;
use crate::infra::Infra;
use crate::infra_cache::InfraCache;
use crate::schema::operation::{Operation, OperationResult};

pub fn edit(
    conn: &PgConnection,
    infra: i32,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> ApiResult<(Vec<OperationResult>, InvalidationZone)> {
    // Use a transaction to give scope to the infra lock
    // Retrieve and lock infra
    let infra = Infra::retrieve_for_update(conn, infra)?;

    // Check if the infra is locked
    if infra.locked {
        return Err(InfraLockedError { infra_id: infra.id }.into());
    }

    // Apply modifications
    let mut operation_results = vec![];
    for operation in operations.iter() {
        operation_results.push(operation.apply(infra.id, conn)?);
    }

    // Bump version
    let infra = infra.bump_version(conn)?;

    // Compute cache invalidation zone
    let invalid_zone = InvalidationZone::compute(infra_cache, &operation_results);

    // Apply operations to infra cache
    infra_cache.apply_operations(&operation_results);
    // Refresh layers if needed
    generated_data::update_all(conn, infra.id, &operation_results, infra_cache)
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    infra.bump_generated_version(conn)?;

    Ok((operation_results, invalid_zone))
}
