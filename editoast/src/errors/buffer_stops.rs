use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use crate::infra_cache::InfraCache;
use crate::schema::{InfraError, ObjectRef, ObjectType};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache);

    let mut buffer_stop_ids = vec![];
    let mut errors = vec![];

    for error in infra_errors {
        buffer_stop_ids.push(error.get_id().clone());
        errors.push(to_value(error).unwrap());
    }

    let count = sql_query(include_str!("sql/buffer_stops_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&buffer_stop_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, buffer_stop_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for (buffer_stop_id, buffer_stop) in infra_cache.buffer_stops().iter() {
        let buffer_stop = buffer_stop.unwrap_buffer_stop();
        // Retrieve invalid refs
        if !infra_cache
            .track_sections()
            .contains_key(&buffer_stop.track)
        {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, buffer_stop.track.clone());
            let infra_error =
                InfraError::new_invalid_reference(buffer_stop_id.clone(), "track", obj_ref);
            errors.push(infra_error);
            continue;
        }

        let track_cache = infra_cache
            .track_sections()
            .get(&buffer_stop.track)
            .unwrap()
            .unwrap_track_section();
        // Retrieve out of range
        if !(0.0..=track_cache.length).contains(&buffer_stop.position) {
            let infra_error = InfraError::new_out_of_range(
                buffer_stop_id.clone(),
                "position",
                buffer_stop.position,
                [0.0, track_cache.length],
            );
            errors.push(infra_error);
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use super::generate_errors;
    use super::InfraError;
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_buffer_stop_cache("BF_error", "E", 250.));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference("BF_error", "track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_buffer_stop_cache("BF_error", "A", 530.));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range("BF_error", "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
