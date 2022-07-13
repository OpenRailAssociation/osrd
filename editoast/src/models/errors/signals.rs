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
    let mut signal_ids = vec![];

    for (signal_id, signal) in infra_cache.signals.iter() {
        // Retrieve invalid refs
        if !infra_cache.track_sections.contains_key(&signal.track) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, signal.track.clone());
            let infra_error = InfraError::new_invalid_reference("track".into(), obj_ref);
            errors.push(to_value(infra_error).unwrap());
            signal_ids.push(signal_id.clone());
            continue;
        }

        let track_cache = infra_cache.track_sections.get(&signal.track).unwrap();
        // Retrieve out of range
        if !(0.0..=track_cache.length).contains(&signal.position) {
            let infra_error = InfraError::new_out_of_range(
                "position".into(),
                signal.position,
                [0.0, track_cache.length],
            );
            errors.push(to_value(infra_error).unwrap());
            signal_ids.push(signal_id.clone());
        }
    }

    let count = sql_query(include_str!("sql/signals_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&signal_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, signal_ids.len());

    Ok(())
}
