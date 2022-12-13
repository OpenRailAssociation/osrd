use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use crate::generated_data::error::ErrGenerator;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, ObjectRef, ObjectType};
use diesel::result::Error as DieselError;
use serde_json::{to_value, Value};

pub const SPEED_SECTION_ERRORS: [ErrGenerator; 2] = [
    ErrGenerator::new(1, check_empty),
    ErrGenerator::new(1, check_speed_section_track_ranges),
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
    let count = sql_query(include_str!("sql/speed_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}

/// Check if a track section has empty speed section
pub fn check_empty(speed_section: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let speed_section = speed_section.unwrap_speed_section();
    if speed_section.track_ranges.is_empty() {
        vec![InfraError::new_empty_object(speed_section, "track_ranges")]
    } else {
        vec![]
    }
}
/// Retrieve invalid refs and out of range errors for speed sections
pub fn check_speed_section_track_ranges(
    speed_section: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let speed_section = speed_section.unwrap_speed_section();
    for (index, track_range) in speed_section.track_ranges.iter().enumerate() {
        let track_id = &track_range.track;
        if !infra_cache
            .track_sections()
            .contains_key::<String>(track_id)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, track_id);
            infra_errors.push(InfraError::new_invalid_reference(
                speed_section,
                format!("track_ranges.{index}"),
                obj_ref,
            ));
            continue;
        }
        let track_cache = infra_cache
            .track_sections()
            .get::<String>(track_id)
            .unwrap()
            .unwrap_track_section();
        for (pos, field) in [(track_range.begin, "begin"), (track_range.end, "end")] {
            if !(0.0..=track_cache.length).contains(&pos) {
                infra_errors.push(InfraError::new_out_of_range(
                    speed_section,
                    format!("track_ranges.{index}.{field}"),
                    pos,
                    [0.0, track_cache.length],
                ));
            }
        }
    }
    infra_errors
}

#[cfg(test)]
mod tests {
    use super::check_speed_section_track_ranges;
    use super::InfraError;
    use crate::infra_cache::tests::{create_small_infra_cache, create_speed_section_cache};
    use crate::infra_cache::Graph;
    use crate::infra_cache::ObjectCache;
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 500.), ("E", 0., 500.), ("B", 0., 250.)];
        let speed_section: ObjectCache =
            create_speed_section_cache("SP_error", track_ranges_error).into();
        infra_cache.add(speed_section.clone());
        let errors = check_speed_section_track_ranges(
            &speed_section,
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error =
            InfraError::new_invalid_reference(&speed_section, "track_ranges.1", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 530.), ("B", 0., 250.)];
        let speed_section: ObjectCache =
            create_speed_section_cache("SP_error", track_ranges_error).into();
        infra_cache.add(speed_section.clone());
        let errors = check_speed_section_track_ranges(
            &speed_section,
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_out_of_range(&speed_section, "track_ranges.0.end", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
