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
    for (speed_id, track_refs) in infra_cache.speed_section_dependencies.iter() {
        for (index, track_ref) in track_refs.iter().enumerate() {
            if !infra_cache.track_sections.contains_key(track_ref) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_ref.into());
                let infra_error =
                    InfraError::new_invalid_reference(format!("track_ranges.{}", index), obj_ref);
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
