use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use crate::infra_cache::InfraCache;
use crate::schema::{InfraError, ObjectRef, ObjectType, SignalCache};
use diesel::result::Error as DieselError;
use serde_json::{to_value, Value};

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
    let count = sql_query(include_str!("sql/signals_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for signal in infra_cache.signals().values() {
        let signal = signal.unwrap_signal();
        // Retrieve invalid refs
        let infra_errors = check_invalid_ref(signal, infra_cache);
        if !infra_errors.is_empty() {
            errors.extend(infra_errors);
            continue;
        }

        errors.extend(check_out_of_range(signal, infra_cache));
    }

    errors
}

/// Retrieve invalid refs for signals
pub fn check_invalid_ref(signal: &SignalCache, infra_cache: &InfraCache) -> Vec<InfraError> {
    if !infra_cache.track_sections().contains_key(&signal.track) {
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, signal.track.clone());
        vec![InfraError::new_invalid_reference(signal, "track", obj_ref)]
    } else {
        vec![]
    }
}

/// Retrieve out of range for signals
pub fn check_out_of_range(signal: &SignalCache, infra_cache: &InfraCache) -> Vec<InfraError> {
    let track_cache = infra_cache
        .track_sections()
        .get(&signal.track)
        .unwrap()
        .unwrap_track_section();
    if !(0.0..=track_cache.length).contains(&signal.position) {
        vec![InfraError::new_out_of_range(
            signal,
            "position",
            signal.position,
            [0.0, track_cache.length],
        )]
    } else {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::generate_errors;
    use super::InfraError;
    use crate::infra_cache::tests::{create_signal_cache, create_small_infra_cache};
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let signal = create_signal_cache("S_error", "E", 250.);
        infra_cache.add(signal.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&signal, "track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let signal = create_signal_cache("S_error", "A", 530.);
        infra_cache.add(signal.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&signal, "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
