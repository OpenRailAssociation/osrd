use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::TrackSectionLayer;
use diesel::PgConnection;
use std::error::Error;

pub fn refresh(conn: &PgConnection, infra_id: i32) -> Result<(), Box<dyn Error>> {
    println!("  Track sections...");
    TrackSectionLayer::clear(conn, infra_id)?;
    TrackSectionLayer::generate(conn, infra_id)?;
    println!("  Signals...");
    SignalLayer::clear(conn, infra_id)?;
    SignalLayer::generate(conn, infra_id)?;
    println!("  Speed sections...");
    SpeedSectionLayer::clear(conn, infra_id)?;
    SpeedSectionLayer::generate(conn, infra_id)?;
    Ok(())
}
