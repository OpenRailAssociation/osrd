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
    let infra_errors = generate_errors(infra_cache);

    let mut speed_section_ids = vec![];
    let mut errors = vec![];

    for error in infra_errors {
        speed_section_ids.push(error.obj_id.clone());
        errors.push(to_value(error).unwrap());
    }

    let count = sql_query(include_str!("sql/speed_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&speed_section_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, speed_section_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];
    for (speed_id, speed_section) in infra_cache.speed_sections.iter() {
        if speed_section.track_ranges.is_empty() {
            let infra_error = InfraError::new_empty_object(speed_id.clone(), "track_ranges");
            errors.push(infra_error);
        }

        for (index, track_range) in speed_section.track_ranges.iter().enumerate() {
            // Retrieve invalid refs
            let track_id = &track_range.track.obj_id;
            if !infra_cache.track_sections.contains_key(track_id) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
                let infra_error = InfraError::new_invalid_reference(
                    speed_id.clone(),
                    format!("track_ranges.{}", index),
                    obj_ref,
                );
                errors.push(infra_error);
                continue;
            }

            let track_cache = infra_cache.track_sections.get(track_id).unwrap();
            // Retrieve out of range
            for (pos, field) in [(track_range.begin, "begin"), (track_range.end, "end")] {
                if !(0.0..=track_cache.length).contains(&pos) {
                    let infra_error = InfraError::new_out_of_range(
                        speed_id.clone(),
                        format!("track_ranges.{}.{}", index, field),
                        pos,
                        [0.0, track_cache.length],
                    );
                    errors.push(infra_error);
                }
            }
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{create_small_infra_cache, create_speed_section_cache},
        railjson::{ObjectRef, ObjectType},
    };

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 500.), ("E", 0., 500.), ("B", 0., 250.)];
        infra_cache.load_speed_section(create_speed_section_cache("SP_error", track_ranges_error));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("SP_error", "track_ranges.1", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 530.), ("B", 0., 250.)];
        infra_cache.load_speed_section(create_speed_section_cache("SP_error", track_ranges_error));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_out_of_range("SP_error", "track_ranges.0.end", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
