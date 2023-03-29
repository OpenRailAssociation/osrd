use crate::infra_cache::Graph;

use super::{GlobalErrorGenerator, NoContext};
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{Endpoint, InfraError, ObjectRef, ObjectType, TrackEndpoint};

// TODO: Use a macro instead to force order and priority continuity
// Example: `static_priority_array![[check_invalid_ref], [check_out_of_range]]`
pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 3] = [
    ObjectErrorGenerator::new(1, check_invalid_ref),
    ObjectErrorGenerator::new(2, check_out_of_range),
    ObjectErrorGenerator::new(3, check_odd_location),
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

/// Check the location of the buffer stop
/// A buffer stop must protect the end of the infrastructures.
/// We trigger a warning when:
/// - It is not placed on track at the end of the infrastructure, it is an error.
/// - Another buffer stop protect the track endpoint (the buffer stop is useless and should be removed).
fn check_odd_location(
    buffer_stop: &ObjectCache,
    infra_cache: &InfraCache,
    graph: &Graph,
) -> Vec<InfraError> {
    let buffer_stop = buffer_stop.unwrap_buffer_stop();
    let track_id = &buffer_stop.track;
    let is_linked_start = graph.has_neighbour(&TrackEndpoint::new(track_id, Endpoint::Begin));
    let is_linked_end = graph.has_neighbour(&TrackEndpoint::new(track_id, Endpoint::End));

    // The track is not at the end of the infra
    if is_linked_end && is_linked_start {
        return vec![InfraError::new_odd_buffer_stop_location(buffer_stop)];
    }

    let buffer_stops = infra_cache.get_track_refs_type(track_id, ObjectType::BufferStop);

    // The number of buffer stops matches the number of ends of the track
    if buffer_stops.len() == 1 || (buffer_stops.len() == 2 && !is_linked_end && !is_linked_start) {
        return vec![];
    }

    // Retrieve the first and last buffer stops on the track
    let mut buffer_stops: Vec<_> = buffer_stops
        .iter()
        .map(|bs| {
            infra_cache
                .buffer_stops()
                .get(&bs.obj_id)
                .unwrap()
                .unwrap_buffer_stop()
        })
        .collect();
    buffer_stops.sort_by(|a, b| a.position.partial_cmp(&b.position).unwrap());
    let first_bs = buffer_stops[0];
    let last_bs = buffer_stops[buffer_stops.len() - 1];

    // Check if the buffer stop is not protecting the end of the infra
    if (is_linked_start || first_bs.obj_id != buffer_stop.obj_id)
        && (is_linked_end || last_bs.obj_id != buffer_stop.obj_id)
    {
        return vec![InfraError::new_odd_buffer_stop_location(buffer_stop)];
    }

    vec![]
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
    use crate::generated_data::error::buffer_stops::check_odd_location;
    use crate::infra_cache::tests::create_track_section_cache;
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::infra_cache::Graph;
    use crate::schema::Endpoint;
    use crate::schema::{ObjectRef, ObjectType};
    use rstest::rstest;

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

    #[rstest]
    #[case(25.)]
    #[case(175.)]
    fn complex_missing_buffer_stop(#[case] pos: f64) {
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

    #[rstest]
    #[case("B", 50.)]
    #[case("A", 30.)]
    #[case("C", 450.)]
    fn odd_location(#[case] track: &str, #[case] pos: f64) {
        let mut infra_cache = create_small_infra_cache();
        let bs = create_buffer_stop_cache("bs_test", track, pos);
        infra_cache.add(bs.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_odd_location(&bs.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let error = InfraError::new_odd_buffer_stop_location(&bs);
        assert_eq!(error, errors[0]);
    }

    #[test]
    fn odd_location_complex() {
        let mut infra_cache = create_small_infra_cache();
        let track = create_track_section_cache("track_test", 200.);
        infra_cache.add(track);
        let valid_begin = create_buffer_stop_cache("valid_begin", "track_test", 10.);
        infra_cache.add(valid_begin.clone());
        let valid_end = create_buffer_stop_cache("valid_end", "track_test", 190.);
        infra_cache.add(valid_end.clone());
        let bs = create_buffer_stop_cache("invalid", "track_test", 100.);
        infra_cache.add(bs.clone());
        let graph = Graph::load(&infra_cache);

        // Verify that the valid buffer stops doesn't generate any errors
        for valid_bs in [valid_begin, valid_end] {
            let errors = check_odd_location(&valid_bs.into(), &infra_cache, &graph);
            assert_eq!(0, errors.len());
        }

        let errors = check_odd_location(&bs.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let error = InfraError::new_odd_buffer_stop_location(&bs);
        assert_eq!(error, errors[0]);
    }
}
