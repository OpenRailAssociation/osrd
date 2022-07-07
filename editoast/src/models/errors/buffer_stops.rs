use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::InfraError;
use crate::railjson::ObjectType;
use crate::{infra_cache::InfraCache, railjson::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn generate_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let mut errors = vec![];
    let mut buffer_stop_ids = vec![];

    for (buffer_stop_id, buffer_stop) in infra_cache.buffer_stops.iter() {
        // Retrieve invalid refs
        if !infra_cache.track_sections.contains_key(&buffer_stop.track) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, buffer_stop.track.clone());
            let infra_error = InfraError::new_invalid_reference("track", obj_ref);
            errors.push(to_value(infra_error).unwrap());
            buffer_stop_ids.push(buffer_stop_id.clone());
            continue;
        }

        let track_cache = infra_cache.track_sections.get(&buffer_stop.track).unwrap();
        // Retrieve out of range
        if !(0.0..=track_cache.length).contains(&buffer_stop.position) {
            let infra_error = InfraError::new_out_of_range(
                "position",
                buffer_stop.position,
                [0.0, track_cache.length],
            );
            errors.push(to_value(infra_error).unwrap());
            buffer_stop_ids.push(buffer_stop_id.clone());
        }
    }

    let count = sql_query(include_str!("sql/buffer_stops_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&buffer_stop_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, buffer_stop_ids.len());

    Ok(())
}
