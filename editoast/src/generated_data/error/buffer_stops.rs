use super::graph::Graph;
use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use rocket::form::prelude::buffer;

use crate::generated_data::error::ErrGenerator;
use crate::infra_cache::InfraCache;
use crate::schema::{BufferStopCache, InfraError, ObjectRef, ObjectType};
use diesel::result::Error as DieselError;
use serde_json::{to_value, Value};

const BUFFER_STOP_ERRORS: [ErrGenerator<&BufferStopCache>; 2] =
    [check_invalid_ref, check_out_of_range];

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache);

    let errors: Vec<Value> = infra_errors
        .iter()
        .map(|error| to_value(error).unwrap())
        .collect();

    let count = sql_query(include_str!("sql/buffer_stops_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());
    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for buffer_stop in infra_cache.buffer_stops().values() {
        let buffer_stop = buffer_stop.unwrap_buffer_stop();
        // Retrieve invalid refs
        for f in BUFFER_STOP_ERRORS.iter() {
            errors.extend(f(buffer_stop, infra_cache, &Graph::load(infra_cache)));
        }
        // let infra_errors = check_invalid_ref(buffer_stop, infra_cache);
        // if !infra_errors.is_empty() {
        //     errors.extend(infra_errors);
        //     continue;
        // }

        // Retrieve out of range
        //errors.extend(check_out_of_range(buffer_stop, infra_cache));
    }
    errors
}

/// Retrieve invalid refs errors for buffer stops
pub fn check_invalid_ref(
    buffer_stop: &BufferStopCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    if !infra_cache
        .track_sections()
        .contains_key(&buffer_stop.track)
    {
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, buffer_stop.track.clone());
        vec![InfraError::new_invalid_reference(
            buffer_stop,
            "track",
            obj_ref,
        )]
    } else {
        vec![]
    }
}

/// Retrieve out of range position errors for buffer stops
pub fn check_out_of_range(
    buffer_stop: &'static BufferStopCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let track_cache = infra_cache
        .track_sections()
        .get(&buffer_stop.track)
        .unwrap()
        .unwrap_track_section();
    if !(0.0..=track_cache.length).contains(&buffer_stop.position) {
        vec![InfraError::new_out_of_range(
            buffer_stop,
            "position",
            buffer_stop.position,
            [0.0, track_cache.length],
        )]
    } else {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::check_invalid_ref;
    use super::check_out_of_range;
    use super::InfraError;
    use crate::generated_data::error::graph::Graph;
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let bf = create_buffer_stop_cache("BF_error", "E", 250.);
        infra_cache.add(bf.clone());
        let errors = check_invalid_ref(&bf, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&bf, "track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let bf = create_buffer_stop_cache("BF_error", "A", 530.);
        infra_cache.add(bf.clone());
        let errors = check_out_of_range(&bf, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&bf, "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
