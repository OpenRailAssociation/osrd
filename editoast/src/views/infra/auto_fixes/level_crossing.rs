use itertools::Itertools;
use json_patch::Patch;
use json_patch::PatchOperation;
use json_patch::RemoveOperation;
use json_patch::ReplaceOperation;
use ordered_float::OrderedFloat;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDObject as _;
use schemas::primitives::ObjectRef;
use schemas::primitives::ObjectType;
use serde_json::json;
use std::collections::HashMap;
use tracing::debug;

use super::Fix;
use super::OrderedOperation;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorType;
use crate::infra_cache::ObjectCache;
use crate::infra_cache::object_cache::LevelCrossingCache;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::operation::DeleteOperation;
use crate::infra_cache::operation::Operation;
use crate::infra_cache::operation::UpdateOperation;

fn invalid_part_to_ordered_operation(
    level_crossing: &LevelCrossingCache,
    object_ref: &ObjectRef,
) -> Option<OrderedOperation> {
    let (track_refs, _) = level_crossing
        .parts
        .iter()
        .enumerate()
        .find(|(_idx, part)| part.track.as_str() == object_ref.obj_id)?;
    Some(OrderedOperation::RemoveTrackRef { track_refs })
}

fn out_of_range_part_to_ordered_operation(
    level_crossing: &LevelCrossingCache,
    new_cache: &mut LevelCrossingCache,
    object_ref: &ObjectRef,
    expected_range: &[f64; 2],
) -> Option<OrderedOperation> {
    let (track_refs, part) = level_crossing
        .parts
        .iter()
        .enumerate()
        .find(|(_idx, part)| part.track.as_str() == object_ref.obj_id)?;
    // Update cache
    let new_position = part.position.clamp(expected_range[0], expected_range[1]);
    new_cache.parts[track_refs].position = new_position;
    Some(OrderedOperation::UpdatePosition {
        track_refs,
        new_position: OrderedFloat(new_position),
    })
}

pub fn fix_level_crossing(
    level_crossing: &LevelCrossingCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    let mut new_lc = level_crossing.clone();
    let operation = errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::EmptyObject => Some(OrderedOperation::Delete),
            InfraErrorType::InvalidReference { reference }
                if reference.obj_type == ObjectType::TrackSection =>
            {
                new_lc
                    .parts
                    .retain(|part| part.track.as_str() != reference.obj_id);
                invalid_part_to_ordered_operation(level_crossing, reference)
            }
            InfraErrorType::OutOfRange {
                reference,
                expected_range,
                ..
            } if reference.obj_type == ObjectType::TrackSection => {
                out_of_range_part_to_ordered_operation(
                    level_crossing,
                    &mut new_lc,
                    reference,
                    expected_range,
                )
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
                obj_id: level_crossing.get_id().clone(),
                obj_type: level_crossing.get_type(),
                railjson_patch: Patch(vec![PatchOperation::Remove(RemoveOperation {
                    path: format!("/parts/{track_refs}").parse().unwrap(),
                })]),
            }),
            OrderedOperation::UpdatePosition {
                track_refs,
                new_position,
            } => Operation::Update(UpdateOperation {
                obj_id: level_crossing.get_id().clone(),
                obj_type: level_crossing.get_type(),
                railjson_patch: Patch(vec![PatchOperation::Replace(ReplaceOperation {
                    path: format!("/parts/{track_refs}/position").parse().unwrap(),
                    value: json!(new_position),
                })]),
            }),
            OrderedOperation::Delete => {
                Operation::Delete(DeleteOperation::from(level_crossing.get_ref()))
            }
        })
        .map(Some)
        .reduce(super::reduce_operation)
        .flatten();
    operation
        .map(|operation| {
            let cache_operation = match operation {
                Operation::Update(_) => CacheOperation::Update(ObjectCache::from(new_lc)),
                Operation::Delete(_) => CacheOperation::Delete(level_crossing.get_ref()),
                Operation::Create(_) => panic!("We should not create new level crossings"),
            };
            (level_crossing.get_ref(), (operation, cache_operation))
        })
        .into_iter()
        .collect()
}

#[cfg(test)]
mod tests {
    use json_patch::Patch;

    use crate::generated_data::infra_error::InfraError;
    use crate::infra_cache::ObjectCache;
    use crate::infra_cache::object_cache::LevelCrossingCache;
    use crate::infra_cache::object_cache::LevelCrossingPartCache;
    use crate::infra_cache::operation::CacheOperation;
    use crate::infra_cache::operation::Operation;
    use schemas::primitives::Identifier;
    use schemas::primitives::OSRDObject as _;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn invalid_refs_ordered_level_crossing() {
        let lc_cache = LevelCrossingCache {
            obj_id: "level_crossing_id".into(),
            parts: vec![
                LevelCrossingPartCache {
                    track: Identifier::from("unknown_track_section_1"),
                    position: 0.,
                },
                LevelCrossingPartCache {
                    track: Identifier::from("track_section_id"),
                    position: 0.,
                },
                LevelCrossingPartCache {
                    track: Identifier::from("unknown_track_section_2"),
                    position: 0.,
                },
            ],
        };
        let error_lc_1 = InfraError::new_invalid_reference(
            &lc_cache,
            "parts.0",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_1"),
        );
        let error_lc_2 = InfraError::new_invalid_reference(
            &lc_cache,
            "parts.2",
            ObjectRef::new(ObjectType::TrackSection, "unknown_track_section_2"),
        );

        let operations =
            super::fix_level_crossing(&lc_cache, vec![error_lc_1, error_lc_2].into_iter());

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) = operations.get(&lc_cache.get_ref()).unwrap();
        let Operation::Update(update_operation) = operation else {
            panic!("not an `Operation::Update`");
        };
        assert_eq!(update_operation.obj_id, "level_crossing_id");
        assert!(matches!(
            update_operation.obj_type,
            ObjectType::LevelCrossing
        ));
        assert_eq!(
            update_operation.railjson_patch,
            serde_json::from_str::<Patch>(
                r#"[
                        {"op":"remove","path":"/parts/2"},
                        {"op":"remove","path":"/parts/0"}
                    ]"#
            )
            .unwrap()
        );
        let CacheOperation::Update(ObjectCache::LevelCrossing(lc)) = cache_operation else {
            panic!("not a `CacheOperation::Update(ObjectCache::LevelCrossing())`");
        };
        assert_eq!(lc.parts.len(), 1);
        assert_eq!(lc.parts[0].track.0, "track_section_id");
    }

    #[test]
    fn empty_object_level_crossings() {
        let lc_cache = LevelCrossingCache {
            obj_id: "level_crossing_id".into(),
            parts: vec![],
        };

        let error_lc = InfraError::new_empty_object(&lc_cache, "parts");

        let operations = super::fix_level_crossing(&lc_cache, vec![error_lc].into_iter());

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) = operations.get(&lc_cache.get_ref()).unwrap();
        let Operation::Delete(delete_operation) = operation else {
            panic!("not an `Operation::Delete`");
        };
        assert_eq!(delete_operation.obj_id, "level_crossing_id");
        assert!(matches!(
            delete_operation.obj_type,
            ObjectType::LevelCrossing
        ));
        let CacheOperation::Delete(object_ref) = cache_operation else {
            panic!("not a `CacheOperation::Delete()`");
        };
        assert_eq!(object_ref.obj_id, "level_crossing_id");
        assert_eq!(object_ref.obj_type, ObjectType::LevelCrossing);
    }

    #[test]
    fn out_of_range_level_crossing() {
        let lc_cache = LevelCrossingCache {
            obj_id: "level_crossing_id".into(),
            parts: vec![
                LevelCrossingPartCache {
                    track: Identifier::from("track_section_id_1"),
                    position: 1500.0, // out of range
                },
                LevelCrossingPartCache {
                    track: Identifier::from("track_section_id_2"),
                    position: 500.0, // valid
                },
            ],
        };
        let error_lc = InfraError::new_out_of_range(
            &lc_cache,
            "parts.0.position",
            1500.0,
            [0.0, 1000.0],
            ObjectRef::new(ObjectType::TrackSection, "track_section_id_1"),
        );

        let operations = super::fix_level_crossing(&lc_cache, vec![error_lc].into_iter());

        assert_eq!(operations.len(), 1);

        let (operation, cache_operation) = operations.get(&lc_cache.get_ref()).unwrap();
        let Operation::Update(update_operation) = operation else {
            panic!("not an `Operation::Update`");
        };
        assert_eq!(update_operation.obj_id, "level_crossing_id");
        assert!(matches!(
            update_operation.obj_type,
            ObjectType::LevelCrossing
        ));
        assert_eq!(
            update_operation.railjson_patch,
            serde_json::from_str::<Patch>(
                r#"[{"op":"replace","path":"/parts/0/position","value":1000.0}]"#
            )
            .unwrap()
        );
        let CacheOperation::Update(ObjectCache::LevelCrossing(lc)) = cache_operation else {
            panic!("not a `CacheOperation::Update(ObjectCache::LevelCrossing())`");
        };
        assert_eq!(lc.parts.len(), 2);
        assert_eq!(lc.parts[0].track.0, "track_section_id_1");
        assert_eq!(lc.parts[0].position, 1000.0);
    }
}
