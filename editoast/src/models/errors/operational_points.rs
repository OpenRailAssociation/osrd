use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::InfraError;
use crate::railjson::ObjectType;
use crate::{infra_cache::InfraCache, railjson::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let (errors, op_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/operational_points_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&op_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, op_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut op_ids = vec![];
    for (op_id, op) in infra_cache.operational_points.iter() {
        if op.parts.is_empty() {
            let infra_error = InfraError::new_empty_object("parts");
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

    (errors, op_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{create_operational_point_cache, create_small_infra_cache},
        railjson::{ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_operational_point(create_operational_point_cache("OP_error", "E", 250.));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("parts.0.track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("OP_error", ids[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_operational_point(create_operational_point_cache("OP_error", "A", 530.));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_out_of_range("parts.0.position", 530., [0.0, 500.]);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("OP_error", ids[0]);
    }
}
