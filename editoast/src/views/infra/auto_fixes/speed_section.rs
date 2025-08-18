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
use schemas::infra::InfraObject;
use schemas::infra::SpeedSection;
use schemas::primitives::OSRDIdentified as _;
use schemas::primitives::OSRDObject as _;
use schemas::primitives::ObjectRef;

fn invalid_reference_to_ordered_operation(
    speed_section: &SpeedSection,
    object_ref: &ObjectRef,
) -> Option<OrderedOperation> {
    let (track_refs, _) = speed_section
        .track_ranges
        .iter()
        .enumerate()
        .find(|(_idx, track_range)| track_range.track.as_str() == object_ref.obj_id)?;
    Some(OrderedOperation::RemoveTrackRef { track_refs })
}

pub fn fix_speed_section(
    speed_section: &SpeedSection,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    let operation = errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::EmptyObject => Some(OrderedOperation::Delete),
            InfraErrorType::InvalidReference { reference } => {
                invalid_reference_to_ordered_operation(speed_section, reference)
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
                obj_id: speed_section.get_id().clone(),
                obj_type: speed_section.get_type(),
                railjson_patch: Patch(vec![PatchOperation::Remove(RemoveOperation {
                    path: format!("/track_ranges/{track_refs}").parse().unwrap(),
                })]),
            }),
            OrderedOperation::Delete => {
                Operation::Delete(DeleteOperation::from(speed_section.get_ref()))
            }
        })
        .map(Some)
        .reduce(super::reduce_operation)
        .flatten();
    operation
        .and_then(|operation| {
            let cache_operation = match CacheOperation::try_from_operation(
                &operation,
                InfraObject::SpeedSection {
                    railjson: speed_section.clone(),
                },
            ) {
                Ok(cache_operation) => cache_operation,
                Err(e) => {
                    error!("failed to convert `Operation` on speed section into a `CacheOperation`: {e}");
                    return None;
                }
            };
            Some((speed_section.get_ref(), (operation, cache_operation)))
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
    use schemas::infra::SpeedSection;
    use schemas::primitives::Identifier;
    use schemas::primitives::OSRDObject as _;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn invalid_refs_ordered_speed_section() {
        let speed_section_cache = SpeedSection {
            id: Identifier::from("speed_section_id"),
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
        let error_speed_section_1 = InfraError::new_invalid_reference(
            &speed_section_cache,
            "speed_section",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_1"),
        );
        let error_speed_section_2 = InfraError::new_invalid_reference(
            &speed_section_cache,
            "speed_section",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_2"),
        );

        let operations = super::fix_speed_section(
            &speed_section_cache,
            vec![error_speed_section_1, error_speed_section_2].into_iter(),
        );

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) = operations.get(&speed_section_cache.get_ref()).unwrap();
        let Operation::Update(update_operation) = operation else {
            panic!("not an `Operation::Update`");
        };
        assert_eq!(update_operation.obj_id, "speed_section_id");
        assert!(matches!(
            update_operation.obj_type,
            ObjectType::SpeedSection
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
        let CacheOperation::Update(ObjectCache::SpeedSection(speed_section)) = cache_operation
        else {
            panic!("not a `CacheOperation::Update(ObjectCache::SpeedSection())`");
        };
        assert_eq!(speed_section.track_ranges.len(), 1);
        assert_eq!(speed_section.track_ranges[0].track.0, "track_section_id");
    }

    #[test]
    fn empty_object_and_invalid_ref_speed_section() {
        let speed_section_cache = SpeedSection {
            id: Identifier::from("speed_section_id"),
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
        let error_speed_section_1 = InfraError::new_invalid_reference(
            &speed_section_cache,
            "speed_section",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_1"),
        );
        let error_speed_section_2 =
            InfraError::new_empty_object(&speed_section_cache, "track_ranges");

        let operations = super::fix_speed_section(
            &speed_section_cache,
            vec![error_speed_section_1, error_speed_section_2].into_iter(),
        );

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) = operations.get(&speed_section_cache.get_ref()).unwrap();
        let Operation::Delete(delete_operation) = operation else {
            panic!("not an `Operation::Delete`");
        };
        assert_eq!(delete_operation.obj_id, "speed_section_id");
        assert!(matches!(
            delete_operation.obj_type,
            ObjectType::SpeedSection
        ));
        let CacheOperation::Delete(object_ref) = cache_operation else {
            panic!("not a `CacheOperation::Delete()`");
        };
        assert_eq!(object_ref.obj_id, "speed_section_id");
        assert_eq!(object_ref.obj_type, ObjectType::SpeedSection);
    }
}
