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
    let mut speed_section_ids = vec![];
    for (speed_id, speed_section) in infra_cache.speed_sections.iter() {
        for (index, track_range) in speed_section.track_ranges.iter().enumerate() {
            // Retrieve invalid refs
            let track_id = &track_range.track.obj_id;
            if !infra_cache.track_sections.contains_key(track_id) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
                let infra_error =
                    InfraError::new_invalid_reference(format!("track_ranges.{}", index), obj_ref);
                errors.push(to_value(infra_error).unwrap());
                speed_section_ids.push(speed_id.clone());
                continue;
            }

            let track_cache = infra_cache.track_sections.get(track_id).unwrap();
            // Retrieve out of range
            if !(0.0..=track_cache.length).contains(&track_range.begin) {
                let infra_error = InfraError::new_out_of_range(
                    format!("track_ranges.{}.begin", index),
                    track_range.begin,
                    [0.0, track_cache.length],
                );
                errors.push(to_value(infra_error).unwrap());
                speed_section_ids.push(speed_id.clone());
            }
            if !(0.0..=track_cache.length).contains(&track_range.end) {
                let infra_error = InfraError::new_out_of_range(
                    format!("track_ranges.{}.end", index),
                    track_range.begin,
                    [0.0, track_cache.length],
                );
                errors.push(to_value(infra_error).unwrap());
                speed_section_ids.push(speed_id.clone());
            }
        }
    }

    let count = sql_query(include_str!("sql/speed_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&speed_section_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, speed_section_ids.len());

    Ok(())
}
