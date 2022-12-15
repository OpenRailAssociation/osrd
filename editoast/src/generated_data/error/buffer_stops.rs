use crate::infra_cache::Graph;

use super::{GlobalErrorGenerator, NoContext};
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, ObjectRef, ObjectType};

// TODO: Use a macro instead to force order and priority continuity
// Example: `static_priority_array![[check_invalid_ref], [check_out_of_range]]`
pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_invalid_ref),
    ObjectErrorGenerator::new(2, check_out_of_range),
];
pub const GLOBAL_GENERATORS: [GlobalErrorGenerator<NoContext>; 1] =
    [GlobalErrorGenerator::new(check_missing)];

/// Retrieve invalid refs errors for buffer stops
fn check_invalid_ref(
    buffer_stop: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let buffer_stop = buffer_stop.unwrap_buffer_stop();
    if !infra_cache
        .track_sections()
        .contains_key(&buffer_stop.track)
    {
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, buffer_stop.track.clone());
        vec![InfraError::new_invalid_reference(
            buffer_stop,
            "track",
            obj_ref,
        )]
    } else {
        vec![]
    }
}

/// Retrieve out of range position errors for buffer stops
fn check_out_of_range(
    buffer_stop: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let buffer_stop = buffer_stop.unwrap_buffer_stop();
    let track_cache = infra_cache
        .track_sections()
        .get(&buffer_stop.track)
        .unwrap()
        .unwrap_track_section();
    if !(0.0..=track_cache.length).contains(&buffer_stop.position) {
        vec![InfraError::new_out_of_range(
            buffer_stop,
            "position",
            buffer_stop.position,
            [0.0, track_cache.length],
        )]
    } else {
        vec![]
    }
}

/// Check if buffer stops are missing in the track section
fn check_missing(infra_cache: &InfraCache, graph: &Graph) -> Vec<InfraError> {
    let mut infra_errors = vec![];

    for track in infra_cache.track_sections().values() {
        let track = track.unwrap_track_section();
        if !graph.has_neighbour(&track.get_begin()) || !graph.has_neighbour(&track.get_end()) {
            let track_refs = infra_cache.track_sections_refs.get(&track.obj_id);
            if track_refs.is_none()
                || !track_refs
                    .unwrap()
                    .iter()
                    .any(|x| x.obj_type == ObjectType::BufferStop)
            {
                infra_errors.push(InfraError::new_no_buffer_stop(track, "buffer_stop"));
            }
        }
    }
    infra_errors
}

#[cfg(test)]
pub mod tests {
    use super::check_invalid_ref;
    use super::check_out_of_range;
    use super::InfraError;
    use crate::generated_data::error::buffer_stops::check_missing;
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::infra_cache::Graph;
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();

        let bf = create_buffer_stop_cache("BF_error", "E", 250.);
        infra_cache.add(bf.clone());
        let errors =
            check_invalid_ref(&bf.clone().into(), &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&bf, "track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let bf = create_buffer_stop_cache("BF_error", "A", 530.);
        infra_cache.add(bf.clone());
        let errors =
            check_out_of_range(&bf.clone().into(), &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&bf, "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn missing_buffer_stop() {
        let mut infra_cache = create_small_infra_cache();
        let obj_ref = ObjectRef::new(ObjectType::BufferStop, "BF1");
        infra_cache.apply_delete(&obj_ref);
        let graph = Graph::load(&infra_cache);
        let errors = check_missing(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_no_buffer_stop(
            infra_cache.track_sections().get("A").unwrap(),
            "buffer_stop",
        );
        assert_eq!(infra_error, errors[0]);
    }
}
