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
    let mut op_ids = vec![];
    for (op_id, op) in infra_cache.operational_points.iter() {
        if op.parts.is_empty() {
            let infra_error = InfraError::new_empty_object("parts".into());
            errors.push(to_value(infra_error).unwrap());
            op_ids.push(op_id.clone());
        }

        for (index, part) in op.parts.iter().enumerate() {
            // Retrieve invalid refs
            let track_id = &part.track.obj_id;
            if !infra_cache.track_sections.contains_key(track_id) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
                let infra_error =
                    InfraError::new_invalid_reference(format!("parts.{}.track", index), obj_ref);
                errors.push(to_value(infra_error).unwrap());
                op_ids.push(op_id.clone());
                continue;
            }

            let track_cache = infra_cache.track_sections.get(track_id).unwrap();
            // Retrieve out of range
            if !(0.0..=track_cache.length).contains(&part.position) {
                let infra_error = InfraError::new_out_of_range(
                    format!("parts.{}.position", index),
                    part.position,
                    [0.0, track_cache.length],
                );
                errors.push(to_value(infra_error).unwrap());
                op_ids.push(op_id.clone());
            }
        }
    }

    let count = sql_query(include_str!("sql/operational_points_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&op_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, op_ids.len());

    Ok(())
}
