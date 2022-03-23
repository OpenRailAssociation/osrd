use crate::infra_cache::InfraCache;
use crate::models::DBConnection;
use crate::models::GeneratedInfra;
use crate::models::Infra;
use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::TrackSectionLayer;
use crate::railjson::operation::Operation;
use diesel::result::Error;
use diesel::PgConnection;

pub fn refresh(conn: &PgConnection, infra: &Infra, force: bool) -> Result<(), Error> {
    // Check if refresh is needed
    let mut gen_infra = GeneratedInfra::retrieve(conn, infra.id);
    if !force && infra.version == gen_infra.version {
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
    gen_infra.version = infra.version;
    Ok(gen_infra.save(conn))
}

pub async fn update(
    conn: &DBConnection,
    infra_id: i32,
    operations: &Vec<Operation>,
    infra_cache: &InfraCache,
) -> Result<(), Error> {
    TrackSectionLayer::update(conn, infra_id, operations).await?;
    SignalLayer::update(conn, infra_id, operations, infra_cache).await?;
    SpeedSectionLayer::update(conn, infra_id, operations, infra_cache).await?;
    Ok(())
}
