use schemas::primitives::ObjectRef;
use schemas::primitives::ObjectType;

use super::NoContext;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_empty),
    ObjectErrorGenerator::new(2, check_lc_parts),
];

/// Check if level crossing is empty
pub fn check_empty(lc: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let level_crossing = lc.unwrap_level_crossing();
    if level_crossing.parts.is_empty() {
        vec![InfraError::new_empty_object(lc, "parts")]
    } else {
        vec![]
    }
}

/// Retrieve invalid ref and out of range errors for level crossings
pub fn check_lc_parts(lc: &ObjectCache, infra_cache: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let level_crossing = lc.unwrap_level_crossing();

    let mut infra_errors = Vec::new();

    for (index, level_crossing_part) in level_crossing.parts.iter().enumerate() {
        let track_id = level_crossing_part.track.as_ref();

        if !infra_cache.track_sections().contains_key(track_id) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id);
            infra_errors.push(InfraError::new_invalid_reference(
                lc,
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
        if !(0.0..=track_cache.length).contains(&level_crossing_part.position) {
            infra_errors.push(InfraError::new_out_of_range(
                lc,
                format!("parts.{index}.position"),
                level_crossing_part.position,
                [0.0, track_cache.length],
                ObjectRef::new(ObjectType::TrackSection, track_id),
            ));
        }
    }

    infra_errors
}

#[cfg(test)]
mod tests {
    use super::InfraError;
    use super::check_empty;
    use super::check_lc_parts;
    use crate::infra_cache::Graph;
    use crate::infra_cache::object_cache::LevelCrossingCache;
    use crate::infra_cache::tests::create_level_crossing_cache;
    use crate::infra_cache::tests::create_small_infra_cache;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn empty() {
        let mut infra_cache = create_small_infra_cache();
        let level_crossing = LevelCrossingCache {
            obj_id: "LC_error".into(),
            parts: vec![],
        };
        infra_cache.add(&level_crossing).unwrap();
        let errors = check_empty(
            &level_crossing.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );

        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_empty_object(&level_crossing, "parts");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let level_crossing = create_level_crossing_cache("LC_error", "E", 250.);
        infra_cache.add(&level_crossing).unwrap();
        let errors = check_lc_parts(
            &level_crossing.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error =
            InfraError::new_invalid_reference(&level_crossing, "parts.0.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_parts_position() {
        let mut infra_cache = create_small_infra_cache();
        let level_crossing = create_level_crossing_cache("LC_error", "A", 530.);
        infra_cache.add(&level_crossing).unwrap();
        let errors = check_lc_parts(
            &level_crossing.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "A");
        let infra_error = InfraError::new_out_of_range(
            &level_crossing,
            "parts.0.position",
            530.,
            [0.0, 500.],
            obj_ref,
        );
        assert_eq!(infra_error, errors[0]);
    }
}
