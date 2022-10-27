use std::collections::HashSet;

use crate::{
    infra_cache::InfraCache,
    schema::{
        operation::{OperationResult, RailjsonObject},
        OSRDObject, ObjectType,
    },
};

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
        operations: &'a [OperationResult],
        infra_cache: &'a InfraCache,
        obj_type: ObjectType,
    ) -> Self {
        let mut res = Self::default();
        for op in operations {
            match op {
                OperationResult::Create(railjson) | OperationResult::Update(railjson)
                    if railjson.get_type() == obj_type =>
                {
                    res.updated.insert(railjson.get_id());
                }
                OperationResult::Create(RailjsonObject::TrackSection { railjson })
                | OperationResult::Update(RailjsonObject::TrackSection { railjson }) => {
                    // Retrieve all the objects that are linked to the track section
                    infra_cache
                        .get_track_refs_type(&railjson.id, obj_type)
                        .iter()
                        .for_each(|obj_ref| {
                            res.updated.insert(&obj_ref.obj_id);
                        });
                }
                OperationResult::Delete(obj_ref) if obj_ref.obj_type == obj_type => {
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
mod test {
    use std::collections::HashSet;

    use super::InvolvedObjects;

    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::schema::operation::{OperationResult, RailjsonObject};
    use crate::schema::{Detector, ObjectRef, ObjectType, TrackSection};

    #[test]
    fn track_section_deleted() {
        let infra_cache = create_small_infra_cache();
        let track = String::from("A");
        let operations = vec![OperationResult::Delete(ObjectRef::new(
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
            OperationResult::Update(RailjsonObject::TrackSection {
                railjson: TrackSection {
                    id: track,
                    length: 420.,
                    ..Default::default()
                },
            }),
            OperationResult::Create(RailjsonObject::Detector {
                railjson: Detector {
                    id: String::from("D2"),
                    ..Default::default()
                },
            }),
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
