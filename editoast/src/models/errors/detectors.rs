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

    let count = sql_query(include_str!("sql/detectors_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&detector_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, detector_ids.len());

    Ok(())
}
