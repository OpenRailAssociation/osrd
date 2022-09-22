use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::InfraError;
use crate::objects::ObjectType;
use crate::{infra_cache::InfraCache, objects::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache);

    let mut detector_ids = vec![];
    let mut errors = vec![];

    for error in infra_errors {
        detector_ids.push(error.obj_id.clone());
        errors.push(to_value(error).unwrap());
    }

    let count = sql_query(include_str!("sql/detectors_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&detector_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, detector_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for (detector_id, detector) in infra_cache.detectors().iter() {
        let detector = detector.unwrap_detector();
        // Retrieve invalid refs
        if !infra_cache.track_sections().contains_key(&detector.track) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, detector.track.clone());
            let infra_error =
                InfraError::new_invalid_reference(detector_id.clone(), "track", obj_ref);
            errors.push(infra_error);
            continue;
        }

        let track_cache = infra_cache
            .track_sections()
            .get(&detector.track)
            .unwrap()
            .unwrap_track_section();
        // Retrieve out of range
        if !(0.0..=track_cache.length).contains(&detector.position) {
            let infra_error = InfraError::new_out_of_range(
                detector_id.clone(),
                "position",
                detector.position,
                [0.0, track_cache.length],
            );
            errors.push(infra_error);
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{create_detector_cache, create_small_infra_cache},
        objects::{ObjectRef, ObjectType},
    };

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_detector_cache("D_error", "E", 250.));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference("D_error", "track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_detector_cache("D_error", "A", 530.));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range("D_error", "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
