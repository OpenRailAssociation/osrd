use crate::client::ChartosConfig;
use crate::error::ApiError;
use crate::infra_cache::InfraCache;
use crate::models::errors::generate_errors;
use crate::models::DBConnection;
use crate::models::Infra;
use crate::models::InvalidationZone;
use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::SwitchLayer;
use crate::models::TrackSectionLayer;
use crate::models::TrackSectionLinkLayer;
use crate::railjson::operation::OperationResult;
use diesel::PgConnection;

/// Refreshes layers if not up to date and returns whether they were refreshed.
/// `force` argument allows us to refresh it in any cases.
pub fn refresh(
    conn: &PgConnection,
    infra: &Infra,
    force: bool,
    chartos_config: &ChartosConfig,
    infra_cache: &InfraCache,
) -> Result<bool, Box<dyn ApiError>> {
    // Check if refresh is needed
    if !force
        && infra.generated_version.is_some()
        && &infra.version == infra.generated_version.as_ref().unwrap()
    {
        return Ok(false);
    }

    // Generate layers
    TrackSectionLayer::refresh(conn, infra.id, chartos_config)?;
    SignalLayer::refresh(conn, infra.id, chartos_config)?;
    SpeedSectionLayer::refresh(conn, infra.id, chartos_config)?;
    TrackSectionLinkLayer::refresh(conn, infra.id, chartos_config)?;
    SwitchLayer::refresh(conn, infra.id, chartos_config)?;

    // Generate errors
    generate_errors(conn, infra.id, infra_cache, chartos_config)?;

    // Update generated infra version
    infra.bump_generated_version(conn)?;
    Ok(true)
}

/// Refresh layers of objects affected by the given list of operations result.
pub fn update(
    conn: &DBConnection,
    infra_id: i32,
    operations: &Vec<OperationResult>,
    cache: &InfraCache,
    zone: &InvalidationZone,
    chartos_config: &ChartosConfig,
) -> Result<(), Box<dyn ApiError>> {
    TrackSectionLayer::update(conn, infra_id, operations, zone, chartos_config)?;
    SignalLayer::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    SpeedSectionLayer::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    TrackSectionLinkLayer::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    SwitchLayer::update(conn, infra_id, operations, cache, zone, chartos_config)?;

    // Generate errors
    generate_errors(conn, infra_id, cache, chartos_config)?;

    Ok(())
}
