use crate::models::SignalLayer;
use crate::models::TrackSectionLayer;
use diesel::PgConnection;
use std::error::Error;

pub fn refresh(conn: &PgConnection, infra_id: i32) -> Result<(), Box<dyn Error>> {
    TrackSectionLayer::clear(conn, infra_id)?;
    TrackSectionLayer::generate(conn, infra_id)?;
    SignalLayer::clear(conn, infra_id)?;
    SignalLayer::generate(conn, infra_id)?;
    Ok(())
}
