use super::{GlobalErrorGenerator, NoContext, ObjectErrorGenerator};
use crate::infra_cache::{Graph, InfraCache, ObjectCache};
use crate::schema::{InfraError, OSRDObject, ObjectRef, ObjectType, TrackEndpoint};

use std::collections::hash_map::Entry;
use std::collections::{HashMap, HashSet};

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 1] =
    [ObjectErrorGenerator::new(1, check_invalid_ref)];
pub const GLOBAL_GENERATORS: [GlobalErrorGenerator<NoContext>; 1] =
    [GlobalErrorGenerator::new(check_overlapping)];

/// Retrieve invalid ref for track section links
pub fn check_invalid_ref(
    link: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let link = link.unwrap_track_section_link();
    let mut infra_errors = vec![];
    for (track_ref, pos) in [(&link.src.track, "src"), (&link.dst.track, "dst")] {
        if !infra_cache
            .track_sections()
            .contains_key::<String>(track_ref)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, track_ref);

            infra_errors.push(InfraError::new_invalid_reference(
                link,
                format!("{pos}.track"),
                obj_ref,
            ));
        }
    }
    infra_errors
}

fn check_overlapping(infra_cache: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let mut errors = vec![];

    // Initialize track endpoints cache
    let mut track_endpoint_cache = HashMap::<&TrackEndpoint, ObjectRef>::new();
    for switch in infra_cache.switches().values() {
        let switch = switch.unwrap_switch();
        for port in switch.ports.values() {
            track_endpoint_cache.insert(port, switch.get_ref());
        }
    }

    // Check for overlapping track links
    for link in infra_cache.track_section_links().values() {
        let link = link.unwrap_track_section_link();
        let mut overlapping_objects = HashSet::new();
        for track_endpoint in [&link.src, &link.dst] {
            match track_endpoint_cache.entry(track_endpoint) {
                Entry::Vacant(e) => {
                    e.insert(link.get_ref());
                }
                Entry::Occupied(e) => {
                    overlapping_objects.insert(e.get().clone());
                }
            }
        }

        // Add errors foreach overlapping object found
        errors.extend(
            overlapping_objects
                .into_iter()
                .map(|e| InfraError::new_overlapping_track_links(link, e)),
        );
    }
    errors
}

#[cfg(test)]
mod tests {
    use super::InfraError;
    use super::{check_invalid_ref, check_overlapping};
    use crate::infra_cache::tests::{
        create_small_infra_cache, create_track_endpoint, create_track_link_cache,
    };
    use crate::schema::{Endpoint, OSRDObject, ObjectRef, ObjectType, TrackEndpoint};

    use std::collections::HashMap;

    #[test]
    fn single_invalid_ref_dst() {
        let mut infra_cache = create_small_infra_cache();
        let link = create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "C"),
            create_track_endpoint(Endpoint::Begin, "E"),
        );
        infra_cache.add(link.clone());
        let errors = check_invalid_ref(&link.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&link, "dst.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn double_invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let link = create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "E"),
            create_track_endpoint(Endpoint::Begin, "F"),
        );
        infra_cache.add(link.clone());
        let errors = check_invalid_ref(&link.clone().into(), &infra_cache, &Default::default());
        assert_eq!(2, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&link, "src.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "F");
        let infra_error = InfraError::new_invalid_reference(&link, "dst.track", obj_ref);
        assert_eq!(infra_error, errors[1]);
    }

    #[test]
    fn link_over_switch() {
        let mut infra_cache = create_small_infra_cache();
        let link = create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "B"),
            create_track_endpoint(Endpoint::Begin, "C"),
        );
        infra_cache.add(link.clone());
        let mut switch_cache = HashMap::<&TrackEndpoint, ObjectRef>::new();

        for switch in infra_cache.switches().values() {
            let switch = switch.unwrap_switch();
            for port in switch.ports.values() {
                switch_cache.insert(port, switch.get_ref());
            }
        }
        let errors = check_overlapping(&infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::Switch, "switch");
        let infra_error = InfraError::new_overlapping_track_links(&link, obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn link_over_link() {
        let mut infra_cache = create_small_infra_cache();
        let link = create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "B"),
            create_track_endpoint(Endpoint::Begin, "C"),
        );
        infra_cache.add(link);
        let mut switch_cache = HashMap::<&TrackEndpoint, ObjectRef>::new();

        for switch in infra_cache.switches().values() {
            let switch = switch.unwrap_switch();
            for port in switch.ports.values() {
                switch_cache.insert(port, switch.get_ref());
            }
        }
        let errors = check_overlapping(&infra_cache, &Default::default());
        assert_eq!(1, errors.len());
    }
}
