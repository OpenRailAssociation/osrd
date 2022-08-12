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
    let (errors, detector_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/detectors_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&detector_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, detector_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut detector_ids = vec![];

    for (detector_id, detector) in infra_cache.detectors.iter() {
        // Retrieve invalid refs
        if !infra_cache.track_sections.contains_key(&detector.track) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, detector.track.clone());
            let infra_error = InfraError::new_invalid_reference("track", obj_ref);
            errors.push(to_value(infra_error).unwrap());
            detector_ids.push(detector_id.clone());
            continue;
        }

        let track_cache = infra_cache.track_sections.get(&detector.track).unwrap();
        // Retrieve out of range
        if !(0.0..=track_cache.length).contains(&detector.position) {
            let infra_error = InfraError::new_out_of_range(
                "position",
                detector.position,
                [0.0, track_cache.length],
            );
            errors.push(to_value(infra_error).unwrap());
            detector_ids.push(detector_id.clone());
        }
    }

    (errors, detector_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{create_detector_cache, create_small_infra_cache},
        railjson::{ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_detector(create_detector_cache("D_error", "E", 250.));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("D_error", ids[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_detector(create_detector_cache("D_error", "A", 530.));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_out_of_range("position", 530., [0.0, 500.]);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("D_error", ids[0]);
    }
}
