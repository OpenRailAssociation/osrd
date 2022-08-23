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
    let (errors, speed_section_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/speed_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&speed_section_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, speed_section_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut speed_section_ids = vec![];
    for (speed_id, speed_section) in infra_cache.speed_sections.iter() {
        if speed_section.track_ranges.is_empty() {
            let infra_error = InfraError::new_empty_object("track_ranges");
            errors.push(to_value(infra_error).unwrap());
            speed_section_ids.push(speed_id.clone());
        }

        for (index, track_range) in speed_section.track_ranges.iter().enumerate() {
            // Retrieve invalid refs
            let track_id = &track_range.track.obj_id;
            if !infra_cache.track_sections.contains_key(track_id) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
                let infra_error =
                    InfraError::new_invalid_reference(format!("track_ranges.{}", index), obj_ref);
                errors.push(to_value(infra_error).unwrap());
                speed_section_ids.push(speed_id.clone());
                continue;
            }

            let track_cache = infra_cache.track_sections.get(track_id).unwrap();
            // Retrieve out of range
            for (pos, field) in [(track_range.begin, "begin"), (track_range.end, "end")] {
                if !(0.0..=track_cache.length).contains(&pos) {
                    let infra_error = InfraError::new_out_of_range(
                        format!("track_ranges.{}.{}", index, field),
                        pos,
                        [0.0, track_cache.length],
                    );
                    errors.push(to_value(infra_error).unwrap());
                    speed_section_ids.push(speed_id.clone());
                }
            }
        }
    }

    (errors, speed_section_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{create_small_infra_cache, create_speed_section_cache},
        railjson::{ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 500.), ("E", 0., 500.), ("B", 0., 250.)];
        infra_cache.load_speed_section(create_speed_section_cache("SP_error", track_ranges_error));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("track_ranges.1", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("SP_error", ids[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 530.), ("B", 0., 250.)];
        infra_cache.load_speed_section(create_speed_section_cache("SP_error", track_ranges_error));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_out_of_range("track_ranges.0.end", 530., [0.0, 500.]);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("SP_error", ids[0]);
    }
}
