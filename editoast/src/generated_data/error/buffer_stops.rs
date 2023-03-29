use crate::infra_cache::Graph;

use super::{GlobalErrorGenerator, NoContext};
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{Endpoint, InfraError, ObjectRef, ObjectType};

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
        let is_linked_start = graph.has_neighbour(&track.get_begin());
        let is_linked_end = graph.has_neighbour(&track.get_end());
        if is_linked_start && is_linked_end {
            continue;
        }
        let buffer_stops = infra_cache.get_track_refs_type(&track.obj_id, ObjectType::BufferStop);
        if buffer_stops.len() >= 2 {
            continue;
        } else if buffer_stops.is_empty() {
            // Missing buffer stops where the track is not linked
            if !is_linked_end {
                infra_errors.push(InfraError::new_missing_buffer_stop(track, Endpoint::End));
            }
            if !is_linked_start {
                infra_errors.push(InfraError::new_missing_buffer_stop(track, Endpoint::Begin));
            }
            continue;
        } else if is_linked_end || is_linked_start {
            // Only one buffer stop and the track is linked to another track
            continue;
        }
        // Only one buffer stop and the track is not linked to another track
        // We have to determine if the missing buffer stop should be at the begin or the end
        let bs_id = &buffer_stops[0].obj_id;
        let buffer_stop = infra_cache.buffer_stops().get(bs_id).unwrap();
        let buffer_stop = buffer_stop.unwrap_buffer_stop();
        if buffer_stop.position < track.length / 2. {
            infra_errors.push(InfraError::new_missing_buffer_stop(track, Endpoint::End));
        } else {
            infra_errors.push(InfraError::new_missing_buffer_stop(track, Endpoint::Begin));
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
    use crate::infra_cache::tests::create_track_section_cache;
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::infra_cache::Graph;
    use crate::schema::Endpoint;
    use crate::schema::{ObjectRef, ObjectType};
    use ntest::test_case;

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
    fn simple_missing_buffer_stop() {
        let mut infra_cache = create_small_infra_cache();
        let obj_ref = ObjectRef::new(ObjectType::BufferStop, "BF1");
        infra_cache.apply_delete(&obj_ref);
        let graph = Graph::load(&infra_cache);
        let errors = check_missing(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_missing_buffer_stop(
            infra_cache.track_sections().get("A").unwrap(),
            Endpoint::Begin,
        );
        assert_eq!(infra_error, errors[0]);
    }

    #[test_case(25.)]
    #[test_case(175.)]
    fn complex_missing_buffer_stop(pos: f64) {
        let mut infra_cache = create_small_infra_cache();
        let track = create_track_section_cache("test", 200.);
        infra_cache.add(track.clone());
        let bs = create_buffer_stop_cache("bs_test", &track.obj_id, pos);
        infra_cache.add(bs);
        let graph = Graph::load(&infra_cache);
        let errors = check_missing(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        let missing_endpoint = if pos < 100. {
            Endpoint::End
        } else {
            Endpoint::Begin
        };
        let error = InfraError::new_missing_buffer_stop(&track, missing_endpoint);
        assert_eq!(error, errors[0]);
    }

    #[test]
    fn missing_two_buffer_stop() {
        let mut infra_cache = create_small_infra_cache();
        let track = create_track_section_cache("test", 200.);
        infra_cache.add(track.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_missing(&infra_cache, &graph);
        assert_eq!(2, errors.len());
        let error = InfraError::new_missing_buffer_stop(&track, Endpoint::End);
        assert_eq!(error, errors[0]);
        let error = InfraError::new_missing_buffer_stop(&track, Endpoint::Begin);
        assert_eq!(error, errors[1]);
    }
}
