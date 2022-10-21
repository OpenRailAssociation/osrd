use diesel::PgConnection;

use crate::api_error::ApiError;
use crate::client::ChartosConfig;
use crate::errors::generate_errors;
use crate::infra::Infra;
use crate::infra_cache::InfraCache;

use crate::layer::{InvalidationZone, Layer};
use crate::schema::operation::OperationResult;
use crate::schema::{
    BufferStop, Catenary, Detector, InfraError, OperationalPoint, Route, Signal, SpeedSection,
    Switch, TrackSection, TrackSectionLink,
};

/// Refreshes layers if not up to date and returns whether they were refreshed.
/// `force` argument allows us to refresh it in any cases.
/// If refreshed you need to call `invalidate_after_refresh` to invalidate chartos layer cache
pub fn refresh(
    conn: &PgConnection,
    infra: &Infra,
    force: bool,
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
    TrackSection::refresh(conn, infra.id)?;
    Signal::refresh(conn, infra.id)?;
    SpeedSection::refresh(conn, infra.id)?;
    TrackSectionLink::refresh(conn, infra.id)?;
    Switch::refresh(conn, infra.id)?;
    Detector::refresh(conn, infra.id)?;
    BufferStop::refresh(conn, infra.id)?;
    Route::refresh(conn, infra.id)?;
    OperationalPoint::refresh(conn, infra.id)?;
    Catenary::refresh(conn, infra.id)?;

    // Generate errors
    generate_errors(conn, infra.id, infra_cache)?;

    // Update generated infra version
    infra.bump_generated_version(conn)?;
    Ok(true)
}

/// Update layers of objects affected by the given list of operations result.
/// You need to call `invalidate_after_update` to invalidate chartos layer cache
pub fn update(
    conn: &PgConnection,
    infra_id: i32,
    operations: &Vec<OperationResult>,
    infra_cache: &InfraCache,
) -> Result<(), Box<dyn ApiError>> {
    TrackSection::update(conn, infra_id, operations, infra_cache)?;
    Signal::update(conn, infra_id, operations, infra_cache)?;
    SpeedSection::update(conn, infra_id, operations, infra_cache)?;
    TrackSectionLink::update(conn, infra_id, operations, infra_cache)?;
    Switch::update(conn, infra_id, operations, infra_cache)?;
    Detector::update(conn, infra_id, operations, infra_cache)?;
    BufferStop::update(conn, infra_id, operations, infra_cache)?;
    Route::update(conn, infra_id, operations, infra_cache)?;
    OperationalPoint::update(conn, infra_id, operations, infra_cache)?;
    Catenary::update(conn, infra_id, operations, infra_cache)?;

    // Generate errors
    generate_errors(conn, infra_id, infra_cache)?;
    Ok(())
}

/// Invalidate bbox chartos of all layers
pub async fn invalidate_after_update(
    infra_id: i32,
    invalidation: &InvalidationZone,
    chartos_config: &ChartosConfig,
) {
    TrackSection::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    Signal::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    SpeedSection::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    TrackSectionLink::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    Switch::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    Detector::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    BufferStop::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    Route::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    OperationalPoint::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    Catenary::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
    InfraError::invalidate_bbox_chartos_layer(infra_id, invalidation, chartos_config).await;
}

/// Invalidate chartos of all layers
pub async fn invalidate_after_refresh(infra_id: i32, chartos_config: &ChartosConfig) {
    TrackSection::invalidate_chartos_layer(infra_id, chartos_config).await;
    Signal::invalidate_chartos_layer(infra_id, chartos_config).await;
    SpeedSection::invalidate_chartos_layer(infra_id, chartos_config).await;
    TrackSectionLink::invalidate_chartos_layer(infra_id, chartos_config).await;
    Switch::invalidate_chartos_layer(infra_id, chartos_config).await;
    Detector::invalidate_chartos_layer(infra_id, chartos_config).await;
    BufferStop::invalidate_chartos_layer(infra_id, chartos_config).await;
    Route::invalidate_chartos_layer(infra_id, chartos_config).await;
    OperationalPoint::invalidate_chartos_layer(infra_id, chartos_config).await;
    Catenary::invalidate_chartos_layer(infra_id, chartos_config).await;
    InfraError::invalidate_chartos_layer(infra_id, chartos_config).await;
}
