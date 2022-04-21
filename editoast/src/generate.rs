use crate::client::ChartosConfig;
use crate::error::ApiError;
use crate::infra_cache::InfraCache;
use crate::models::errors::generate_errors;
use crate::models::DBConnection;
use crate::models::Infra;
use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::TrackSectionLayer;
use crate::railjson::operation::Operation;
use diesel::PgConnection;

/// Refreshes the layers if needed and returns whether they were refreshed.
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

    // Generate errors
    generate_errors(conn, infra.id, infra_cache, chartos_config)?;

    // Update generated infra version
    infra.bump_generated_version(conn)?;
    Ok(true)
}

pub fn update(
    conn: &DBConnection,
    infra_id: i32,
    operations: &Vec<Operation>,
    infra_cache: &mut InfraCache,
    chartos_config: &ChartosConfig,
) -> Result<(), Box<dyn ApiError>> {
    TrackSectionLayer::update(conn, infra_id, operations, chartos_config)?;
    SignalLayer::update(conn, infra_id, operations, infra_cache, chartos_config)?;
    SpeedSectionLayer::update(conn, infra_id, operations, infra_cache, chartos_config)?;

    // Generate errors
    generate_errors(conn, infra_id, infra_cache, chartos_config)?;

    Ok(())
}
