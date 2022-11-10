use diesel::sql_types::{Array, Integer, Json};
use diesel::PgConnection;
use diesel::{sql_query, RunQueryDsl};

use super::graph::Graph;
use crate::generated_data::error::ErrGenerator;
use crate::infra_cache::InfraCache;
use crate::schema::{InfraError, ObjectRef, ObjectType, OperationalPointCache};
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
    let count = sql_query(include_str!("sql/operational_points_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}
pub const OPERATIONAL_POINT_ERRORS: [ErrGenerator<&OperationalPointCache>; 2] =
    [check_empty, check_op_parts];

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for op in infra_cache.operational_points().values() {
        let op = op.unwrap_operational_point();
        for f in OPERATIONAL_POINT_ERRORS.iter() {
            errors.extend(f(op, infra_cache, &Graph::load(infra_cache)));
        }
        // errors.extend(check_empty(op, infra_cache));
        // errors.extend(check_op_parts(op, infra_cache));
    }

    errors
}
/// Check if operational point is empty
pub fn check_empty(
    op: &'static OperationalPointCache,
    _: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    if op.parts.is_empty() {
        vec![InfraError::new_empty_object(op, "parts")]
    } else {
        vec![]
    }
}

/// Retrieve invalide ref and out of range errors for operational points
pub fn check_op_parts(
    op: &'static OperationalPointCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];

    for (index, part) in op.parts.iter().enumerate() {
        let track_id = &part.track;

        if !infra_cache.track_sections().contains_key(track_id) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
            infra_errors.push(InfraError::new_invalid_reference(
                op,
                format!("parts.{index}.track"),
                obj_ref,
            ));
            continue;
        }
        let track_cache = infra_cache
            .track_sections()
            .get(track_id)
            .unwrap()
            .unwrap_track_section();
        // Retrieve out of range
        if !(0.0..=track_cache.length).contains(&part.position) {
            infra_errors.push(InfraError::new_out_of_range(
                op,
                format!("parts.{index}.position"),
                part.position,
                [0.0, track_cache.length],
            ));
        }
    }
    infra_errors
}

#[cfg(test)]
mod tests {
    use crate::infra_cache::tests::{create_operational_point_cache, create_small_infra_cache};
    use crate::schema::{ObjectRef, ObjectType};

    use super::check_op_parts;
    use super::InfraError;
    use crate::generated_data::error::graph::Graph;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let op = create_operational_point_cache("OP_error", "E", 250.);
        infra_cache.add(op.clone());
        let errors = check_op_parts(&op, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&op, "parts.0.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let op = create_operational_point_cache("OP_error", "A", 530.);
        infra_cache.add(op.clone());
        let errors = check_op_parts(&op, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&op, "parts.0.position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
