use std::collections::HashSet;

use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::infra_cache::operation::CacheOperation;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDObject;
use schemas::primitives::ObjectType;

/// This struct gives a set of objects that needs to be updated or deleted given a list of operations.
#[derive(Debug, Clone, Default)]
pub struct InvolvedObjects<'a> {
    /// Ids of objects that needs to be updated
    pub updated: HashSet<&'a String>,
    /// Ids of objects that needs to be deleted
    pub deleted: HashSet<&'a String>,
}

impl<'a> InvolvedObjects<'a> {
    /// Given a list of operations and an object type, return a set of object ids that needs to be updated or deleted.
    /// For example if you have an operation that modify a Track Section, and you call this function with `ObjectType::Signal` as `obj_type`,
    /// You'll have the set of signal ids that are linked to the track section that has been modified.
    pub fn from_operations(
        operations: &'a [CacheOperation],
        infra_cache: &'a InfraCache,
        obj_type: ObjectType,
    ) -> Self {
        let mut res = Self::default();
        for op in operations {
            match op {
                CacheOperation::Create(object_cache) | CacheOperation::Update(object_cache)
                    if object_cache.get_type() == obj_type =>
                {
                    res.updated.insert(object_cache.get_id());
                }
                CacheOperation::Create(ObjectCache::TrackSection(track_section))
                | CacheOperation::Update(ObjectCache::TrackSection(track_section)) => {
                    // Retrieve all the objects that are linked to the track section
                    infra_cache
                        .get_track_refs_type(track_section.get_id(), obj_type)
                        .iter()
                        .for_each(|obj_ref| {
                            res.updated.insert(&obj_ref.obj_id);
                        });
                }
                CacheOperation::Delete(obj_ref) if obj_ref.obj_type == obj_type => {
                    res.deleted.insert(&obj_ref.obj_id);
                }
                _ => (),
            }
        }
        res
    }

    /// Check if there is involved objects. Returns `true` if no objects must be updated or deleted.
    pub fn is_empty(&self) -> bool {
        self.updated.is_empty() && self.deleted.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::InvolvedObjects;
    use crate::infra_cache::ObjectCache;
    use crate::infra_cache::object_cache::DetectorCache;
    use crate::infra_cache::object_cache::TrackSectionCache;
    use crate::infra_cache::operation::CacheOperation;
    use crate::infra_cache::tests::create_small_infra_cache;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn track_section_deleted() {
        let infra_cache = create_small_infra_cache();
        let track = String::from("A");
        let operations = vec![CacheOperation::Delete(ObjectRef::new(
            ObjectType::TrackSection,
            &track,
        ))];
        let involved_objects =
            InvolvedObjects::from_operations(&operations, &infra_cache, ObjectType::TrackSection);
        assert_eq!(involved_objects.updated.len(), 0);
        assert_eq!(involved_objects.deleted, HashSet::from([&track]));
    }

    #[test]
    fn detectors_when_track_section_update() {
        let infra_cache = create_small_infra_cache();
        let track = String::from("B");
        let operations = vec![
            CacheOperation::Update(ObjectCache::TrackSection(TrackSectionCache {
                obj_id: track,
                length: 420.,
                ..Default::default()
            })),
            CacheOperation::Create(ObjectCache::Detector(DetectorCache {
                obj_id: "D2".to_string(),
                track: "TA1".to_string(),
                position: 42.0,
            })),
        ];
        let involved_objects =
            InvolvedObjects::from_operations(&operations, &infra_cache, ObjectType::Detector);
        assert_eq!(involved_objects.deleted.len(), 0);
        let detectors = ["D1".into(), "D2".into()];
        assert_eq!(
            involved_objects.updated,
            detectors.iter().collect::<HashSet<_>>()
        );
    }
}
