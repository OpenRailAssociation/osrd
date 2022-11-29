use super::graph::Graph;
use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use crate::generated_data::error::ErrGenerator;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, ObjectRef, ObjectType};
use diesel::result::Error as DieselError;
use serde_json::{to_value, Value};

// TODO: Use a macro instead to force order and priority continuity
// Example: `static_priority_array![[check_invalid_ref], [check_out_of_range]]`
pub const BUFFER_STOP_ERRORS: [ErrGenerator; 2] = [
    ErrGenerator::new(1, check_invalid_ref),
    ErrGenerator::new(2, check_out_of_range),
];

pub fn insert_errors(
    infra_errors: Vec<InfraError>,
    conn: &PgConnection,
    infra_id: i32,
) -> Result<(), DieselError> {
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

/// Retrieve invalid refs errors for buffer stops
fn check_invalid_ref(
    buffer_stop: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let buffer_stop = buffer_stop.unwrap_buffer_stop();
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
fn check_out_of_range(
    buffer_stop: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let buffer_stop = buffer_stop.unwrap_buffer_stop();
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
pub mod tests {
    use super::check_invalid_ref;
    use super::check_out_of_range;
    use super::InfraError;
    use crate::generated_data::error::graph::Graph;
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::infra_cache::ObjectCache;
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();

        let bf: ObjectCache = create_buffer_stop_cache("BF_error", "E", 250.).into();
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
        let bf: ObjectCache = create_buffer_stop_cache("BF_error", "A", 530.).into();
        infra_cache.add(bf.clone());
        let errors = check_out_of_range(&bf, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&bf, "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
