use crate::infra_cache::InfraCache;
use crate::models::DBConnection;
use crate::models::Infra;
use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::TrackSectionLayer;
use crate::railjson::operation::Operation;
use diesel::PgConnection;
use std::error::Error;

pub fn refresh(conn: &PgConnection, infra: &Infra, force: bool) -> Result<(), Box<dyn Error>> {
    // Check if refresh is needed
    if !force && infra.version == infra.generated_version {
        return Ok(());
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
    Ok(())
}

pub async fn update(
    conn: &DBConnection,
    infra_id: i32,
    operations: &Vec<Operation>,
    infra_cache: &InfraCache,
) -> Result<(), Box<dyn Error>> {
    TrackSectionLayer::update(conn, infra_id, operations).await?;
    SignalLayer::update(conn, infra_id, operations, infra_cache).await?;
    SpeedSectionLayer::update(conn, infra_id, operations, infra_cache).await?;
    Ok(())
}
