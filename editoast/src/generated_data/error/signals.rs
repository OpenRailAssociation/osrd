use super::NoContext;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, ObjectRef, ObjectType};

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_invalid_ref),
    ObjectErrorGenerator::new(2, check_out_of_range),
];

/// Retrieve invalid refs for signals
pub fn check_invalid_ref(
    signal: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let signal = signal.unwrap_signal();
    if !infra_cache.track_sections().contains_key(&signal.track) {
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, signal.track.clone());
        vec![InfraError::new_invalid_reference(signal, "track", obj_ref)]
    } else {
        vec![]
    }
}

/// Retrieve out of range for signals
pub fn check_out_of_range(
    signal: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let signal = signal.unwrap_signal();
    let track_cache = infra_cache
        .track_sections()
        .get(&signal.track)
        .unwrap()
        .unwrap_track_section();
    if !(0.0..=track_cache.length).contains(&signal.position) {
        vec![InfraError::new_out_of_range(
            signal,
            "position",
            signal.position,
            [0.0, track_cache.length],
        )]
    } else {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::check_invalid_ref;
    use super::check_out_of_range;
    use super::InfraError;
    use crate::infra_cache::tests::{create_signal_cache, create_small_infra_cache};
    use crate::infra_cache::Graph;
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let signal = create_signal_cache("S_error", "E", 250.);
        infra_cache.add(signal.clone());
        let errors = check_invalid_ref(
            &signal.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&signal, "track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let signal = create_signal_cache("S_error", "A", 530.);
        infra_cache.add(signal.clone());
        let errors = check_out_of_range(
            &signal.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&signal, "position", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }
}
