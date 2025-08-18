use itertools::Itertools;
use json_patch::Patch;
use json_patch::PatchOperation;
use json_patch::RemoveOperation;
use std::collections::HashMap;
use tracing::debug;
use tracing::error;

use super::Fix;
use super::OrderedOperation;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorType;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::operation::DeleteOperation;
use crate::infra_cache::operation::Operation;
use crate::infra_cache::operation::UpdateOperation;
use schemas::infra::Electrification;
use schemas::infra::InfraObject;
use schemas::primitives::OSRDIdentified as _;
use schemas::primitives::OSRDObject as _;
use schemas::primitives::ObjectRef;

fn invalid_reference_to_ordered_operation(
    electrification: &Electrification,
    object_ref: &ObjectRef,
) -> Option<OrderedOperation> {
    let (track_refs, _) = electrification
        .track_ranges
        .iter()
        .enumerate()
        .find(|(_idx, track_range)| track_range.track.as_str() == object_ref.obj_id)?;
    Some(OrderedOperation::RemoveTrackRef { track_refs })
}

pub fn fix_electrification(
    electrification: &Electrification,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    let operation = errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::EmptyObject => Some(OrderedOperation::Delete),
            InfraErrorType::InvalidReference { reference } => {
                invalid_reference_to_ordered_operation(electrification, reference)
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .unique()
        // Need to invert the ordering because removing from the front would invalidate other indexes
        .sorted_by_key(|ordered_operation| std::cmp::Reverse(ordered_operation.clone()))
        .map(|ordered_operation| match ordered_operation {
            OrderedOperation::RemoveTrackRef { track_refs } => Operation::Update(UpdateOperation {
                obj_id: electrification.get_id().clone(),
                obj_type: electrification.get_type(),
                railjson_patch: Patch(vec![PatchOperation::Remove(RemoveOperation {
                    path: format!("/track_ranges/{track_refs}").parse().unwrap(),
                })]),
            }),
            OrderedOperation::Delete => {
                Operation::Delete(DeleteOperation::from(electrification.get_ref()))
            }
        })
        .map(Some)
        .reduce(super::reduce_operation)
        .flatten();
    operation
        .and_then(|operation| {
            let cache_operation = match CacheOperation::try_from_operation(
                &operation,
                InfraObject::Electrification {
                    railjson: electrification.clone(),
                },
            ) {
                Ok(cache_operation) => cache_operation,
                Err(e) => {
                    error!("failed to convert `Operation` on electrification into a `CacheOperation`: {e}");
                    return None;
                }
            };
            Some((electrification.get_ref(), (operation, cache_operation)))
        })
        .into_iter()
        .collect()
}

#[cfg(test)]
mod tests {
    use json_patch::Patch;

    use crate::generated_data::infra_error::InfraError;
    use crate::infra_cache::ObjectCache;
    use crate::infra_cache::operation::CacheOperation;
    use crate::infra_cache::operation::Operation;
    use schemas::infra::ApplicableDirections;
    use schemas::infra::ApplicableDirectionsTrackRange;
    use schemas::infra::Electrification;
    use schemas::primitives::Identifier;
    use schemas::primitives::OSRDObject as _;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn invalid_refs_ordered_electrification() {
        let electrification_cache = Electrification {
            id: Identifier::from("electrification_id"),
            track_ranges: vec![
                ApplicableDirectionsTrackRange {
                    track: Identifier::from("unknown_track_section_1"),
                    begin: 0.,
                    end: 100.,
                    applicable_directions: ApplicableDirections::StartToStop,
                },
                ApplicableDirectionsTrackRange {
                    track: Identifier::from("track_section_id"),
                    begin: 0.,
                    end: 100.,
                    applicable_directions: ApplicableDirections::StartToStop,
                },
                ApplicableDirectionsTrackRange {
                    track: Identifier::from("unknown_track_section_2"),
                    begin: 0.,
                    end: 100.,
                    applicable_directions: ApplicableDirections::StartToStop,
                },
            ],
            ..Default::default()
        };
        let error_electrification_1 = InfraError::new_invalid_reference(
            &electrification_cache,
            "electrification",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_1"),
        );
        let error_electrification_2 = InfraError::new_invalid_reference(
            &electrification_cache,
            "electrification",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_2"),
        );

        let operations = super::fix_electrification(
            &electrification_cache,
            vec![error_electrification_1, error_electrification_2].into_iter(),
        );

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) =
            operations.get(&electrification_cache.get_ref()).unwrap();
        let Operation::Update(update_operation) = operation else {
            panic!("not an `Operation::Update`");
        };
        assert_eq!(update_operation.obj_id, "electrification_id");
        assert!(matches!(
            update_operation.obj_type,
            ObjectType::Electrification
        ));
        assert_eq!(
            update_operation.railjson_patch,
            serde_json::from_str::<Patch>(
                r#"[
                        {"op":"remove","path":"/track_ranges/2"},
                        {"op":"remove","path":"/track_ranges/0"}
                    ]"#
            )
            .unwrap()
        );
        let CacheOperation::Update(ObjectCache::Electrification(electrification)) = cache_operation
        else {
            panic!("not a `CacheOperation::Update(ObjectCache::Electrification())`");
        };
        assert_eq!(electrification.track_ranges.len(), 1);
        assert_eq!(electrification.track_ranges[0].track.0, "track_section_id");
    }

    #[test]
    fn empty_object_and_invalid_ref_electrification() {
        let electrification_cache = Electrification {
            id: Identifier::from("electrification_id"),
            track_ranges: vec![
                ApplicableDirectionsTrackRange {
                    track: Identifier::from("unknown_track_section_1"),
                    begin: 0.,
                    end: 100.,
                    applicable_directions: ApplicableDirections::StartToStop,
                },
                ApplicableDirectionsTrackRange {
                    track: Identifier::from("track_section_id"),
                    begin: 0.,
                    end: 100.,
                    applicable_directions: ApplicableDirections::StartToStop,
                },
            ],
            ..Default::default()
        };
        let error_electrification_1 = InfraError::new_invalid_reference(
            &electrification_cache,
            "electrification",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_1"),
        );
        let error_electrification_2 =
            InfraError::new_empty_object(&electrification_cache, "track_ranges");

        let operations = super::fix_electrification(
            &electrification_cache,
            vec![error_electrification_1, error_electrification_2].into_iter(),
        );

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) =
            operations.get(&electrification_cache.get_ref()).unwrap();
        let Operation::Delete(delete_operation) = operation else {
            panic!("not an `Operation::Delete`");
        };
        assert_eq!(delete_operation.obj_id, "electrification_id");
        assert!(matches!(
            delete_operation.obj_type,
            ObjectType::Electrification
        ));
        let CacheOperation::Delete(object_ref) = cache_operation else {
            panic!("not a `CacheOperation::Delete()`");
        };
        assert_eq!(object_ref.obj_id, "electrification_id");
        assert_eq!(object_ref.obj_type, ObjectType::Electrification);
    }
}
