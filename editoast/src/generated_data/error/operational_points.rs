use super::NoContext;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use schemas::primitives::ObjectRef;
use schemas::primitives::ObjectType;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_empty),
    ObjectErrorGenerator::new(2, check_op_parts),
];

/// Check if operational point is empty
pub fn check_empty(op: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let op = op.unwrap_operational_point();
    if op.parts.is_empty() {
        vec![InfraError::new_empty_object(op, "parts")]
    } else {
        vec![]
    }
}

/// Retrieve invalide ref and out of range errors for operational points
pub fn check_op_parts(op: &ObjectCache, infra_cache: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let op = op.unwrap_operational_point();
    for (index, part) in op.parts.iter().enumerate() {
        let track_id = &*part.track;

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
    use super::InfraError;
    use super::check_op_parts;
    use crate::infra_cache::Graph;
    use crate::infra_cache::tests::create_operational_point_cache;
    use crate::infra_cache::tests::create_small_infra_cache;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let op = create_operational_point_cache("OP_error", "E", 250.);
        infra_cache.add(&op).unwrap();
        let errors = check_op_parts(&op.clone().into(), &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&op, "parts.0.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let op = create_operational_point_cache("OP_error", "A", 530.);
        infra_cache.add(&op).unwrap();
        let errors = check_op_parts(&op.clone().into(), &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&op, "parts.0.position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
