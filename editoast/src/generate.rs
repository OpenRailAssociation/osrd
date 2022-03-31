use crate::error::ApiError;
use crate::infra_cache::InfraCache;
use crate::models::DBConnection;
use crate::models::Infra;
use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::TrackSectionLayer;
use crate::railjson::operation::Operation;
use diesel::PgConnection;

/// Refreshes the layers if needed and returns whether they were refreshed.
/// `force` argument allows us to refresh it in any cases.
pub fn refresh(conn: &PgConnection, infra: &Infra, force: bool) -> Result<bool, Box<dyn ApiError>> {
    // Check if refresh is needed
    if !force
        && infra.generated_version.is_some()
        && &infra.version == infra.generated_version.as_ref().unwrap()
    {
        return Ok(false);
    }

    // Generate layers
    TrackSectionLayer::clear(conn, infra.id)?;
    TrackSectionLayer::generate(conn, infra.id)?;

    SignalLayer::clear(conn, infra.id)?;
    SignalLayer::generate(conn, infra.id)?;

    SpeedSectionLayer::clear(conn, infra.id)?;
    SpeedSectionLayer::generate(conn, infra.id)?;

    // Update generated infra version
    infra.bump_generated_version(conn)?;
    Ok(true)
}

pub fn update(
    conn: &DBConnection,
    infra_id: i32,
    operations: &Vec<Operation>,
    infra_cache: &mut InfraCache,
) -> Result<(), Box<dyn ApiError>> {
    TrackSectionLayer::update(conn, infra_id, operations)?;
    SignalLayer::update(conn, infra_id, operations, infra_cache)?;
    SpeedSectionLayer::update(conn, infra_id, operations, infra_cache)?;
    Ok(())
}
