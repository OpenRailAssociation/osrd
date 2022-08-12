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
    let (errors, buffer_stop_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/buffer_stops_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&buffer_stop_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, buffer_stop_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
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

    (errors, buffer_stop_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache},
        railjson::{ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_buffer_stop(create_buffer_stop_cache("BF_error", "E", 250.));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("BF_error", ids[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_buffer_stop(create_buffer_stop_cache("BF_error", "A", 530.));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_out_of_range("position", 530., [0.0, 500.]);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("BF_error", ids[0]);
    }
}
