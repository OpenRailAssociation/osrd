use crate::models::GeneratedInfra;
use crate::models::Infra;
use crate::models::SignalLayer;
use crate::models::SpeedSectionLayer;
use crate::models::TrackSectionLayer;
use crate::railjson::ObjectType;
use diesel::result::Error;
use diesel::PgConnection;
use std::collections::HashMap;
use std::collections::HashSet;

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

pub fn update(
    conn: &PgConnection,
    infra_id: i32,
    update_lists: &HashMap<ObjectType, HashSet<String>>,
) -> Result<(), Error> {
    // Update layers
    for (obj_type, obj_ids) in update_lists.iter() {
        match *obj_type {
            ObjectType::TrackSection => TrackSectionLayer::update(conn, infra_id, obj_ids)?,
            ObjectType::Signal => SignalLayer::update(conn, infra_id, obj_ids)?,
            ObjectType::SpeedSection => SpeedSectionLayer::update(conn, infra_id, obj_ids)?,
        };
    }
    Ok(())
}
