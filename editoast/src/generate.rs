use crate::client::ChartosConfig;
use crate::error::ApiError;
use crate::infra_cache::InfraCache;
use crate::layer::InvalidationZone;
use crate::layer::Layer;
use crate::models::errors::generate_errors;
use crate::models::DBConnection;
use crate::models::Infra;
use crate::objects::operation::OperationResult;
use crate::objects::{
    BufferStop, Catenary, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch,
    TrackSection, TrackSectionLink,
};
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
    TrackSection::refresh(conn, infra.id, chartos_config)?;
    Signal::refresh(conn, infra.id, chartos_config)?;
    SpeedSection::refresh(conn, infra.id, chartos_config)?;
    TrackSectionLink::refresh(conn, infra.id, chartos_config)?;
    Switch::refresh(conn, infra.id, chartos_config)?;
    Detector::refresh(conn, infra.id, chartos_config)?;
    BufferStop::refresh(conn, infra.id, chartos_config)?;
    Route::refresh(conn, infra.id, chartos_config)?;
    OperationalPoint::refresh(conn, infra.id, chartos_config)?;
    Catenary::refresh(conn, infra.id, chartos_config)?;

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
    TrackSection::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    Signal::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    SpeedSection::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    TrackSectionLink::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    Switch::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    Detector::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    BufferStop::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    Route::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    OperationalPoint::update(conn, infra_id, operations, cache, zone, chartos_config)?;
    Catenary::update(conn, infra_id, operations, cache, zone, chartos_config)?;

    Ok(())
}
