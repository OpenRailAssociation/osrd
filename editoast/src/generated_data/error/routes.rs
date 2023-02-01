use std::collections::{HashMap, HashSet};

use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::{Graph, InfraCache, ObjectCache};
use crate::schema::{InfraError, OSRDIdentified, OSRDObject, ObjectRef, ObjectType, Waypoint};

use super::GlobalErrorGenerator;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<Context>; 5] = [
    ObjectErrorGenerator::new(1, check_entry_point_ref),
    ObjectErrorGenerator::new(1, check_exit_point_ref),
    ObjectErrorGenerator::new(1, check_release_detectors_ref),
    ObjectErrorGenerator::new(1, check_switches_directions_ref),
    ObjectErrorGenerator::new_ctx(2, check_path),
];

pub const GLOBAL_GENERATORS: [GlobalErrorGenerator<Context>; 1] =
    [GlobalErrorGenerator::new_ctx(check_missing)];

/// Context for the route error generators
#[derive(Debug, Default)]
pub struct Context {
    /// Tracks that are on a route (used to retrieve missing routes)
    tracks_on_routes: HashSet<String>,
}

/// Check if a waypoint ref exists in the infra cache
fn is_waypoint_ref_valid(waypoint: &Waypoint, infra_cache: &InfraCache) -> bool {
    if waypoint.is_detector() {
        infra_cache.detectors().contains_key(waypoint.get_id())
    } else {
        infra_cache.buffer_stops().contains_key(waypoint.get_id())
    }
}

/// Check if a route entry point is a valid reference
fn check_entry_point_ref(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let route = route.unwrap_route();
    if !is_waypoint_ref_valid(&route.entry_point, infra_cache) {
        return vec![InfraError::new_invalid_reference(
            route,
            "entry_point",
            route.entry_point.get_ref(),
        )];
    }
    vec![]
}

/// Check if a route exit point is a valid reference
fn check_exit_point_ref(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let route = route.unwrap_route();
    if !is_waypoint_ref_valid(&route.exit_point, infra_cache) {
        return vec![InfraError::new_invalid_reference(
            route,
            "exit_point",
            route.exit_point.get_ref(),
        )];
    }
    vec![]
}

/// Check if a route release detectors are valid references
fn check_release_detectors_ref(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let route = route.unwrap_route();
    let mut res = vec![];
    for (index, detector) in route.release_detectors.iter().enumerate() {
        if !infra_cache.detectors().contains_key::<String>(detector) {
            res.push(InfraError::new_invalid_reference(
                route,
                format!("release_detectors.{index}"),
                ObjectRef::new(ObjectType::Detector, detector),
            ));
        }
    }
    res
}

/// Check if a route release detectors are valid references
fn check_switches_directions_ref(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let route = route.unwrap_route();
    let mut res = vec![];
    for (switch_id, direction) in route.switches_directions.iter() {
        if !infra_cache.switches().contains_key::<String>(switch_id) {
            res.push(InfraError::new_invalid_reference(
                route,
                format!("switches_directions.{switch_id}"),
                ObjectRef::new(ObjectType::Switch, switch_id),
            ));
            continue;
        }
        let switch_type = &infra_cache
            .switches()
            .get::<String>(switch_id)
            .unwrap()
            .unwrap_switch()
            .switch_type;
        if let Some(switch_type) = infra_cache.switch_types().get(switch_type) {
            let switch_type = switch_type.unwrap_switch_type();
            if !switch_type.groups.contains_key(direction) {
                res.push(InfraError::new_invalid_group(
                    route,
                    format!("switches_directions.{switch_id}"),
                    direction,
                    switch_type.get_id(),
                ))
            }
        }
    }
    res
}

/// Check for all routes if they have a consistent path.
/// We also retrieve track sections that are not used by any route.
fn check_path(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    graph: &Graph,
    mut context: Context,
) -> (Vec<InfraError>, Context) {
    let route = route.unwrap_route();

    let route_path = match route.compute_track_ranges(infra_cache, graph) {
        Some(path) => path,
        None => return (vec![InfraError::new_invalid_path(route)], context),
    };

    // Add tracks on the route to the context
    let tracks_on_route = route_path
        .track_ranges
        .iter()
        .map(|track| (*track.track).clone());
    context.tracks_on_routes.extend(tracks_on_route);

    // Search for switches out of the path
    let mut res = vec![];
    for switch in route.switches_directions.keys() {
        if !route_path.switches_directions.contains_key(switch) {
            res.push(InfraError::new_object_out_of_path(
                route,
                format!("switches_directions.{switch}"),
                ObjectRef::new(ObjectType::Switch, switch),
            ));
        }
    }

    // Search for detectors out of the path
    let track_ranges: HashMap<_, _> = route_path
        .track_ranges
        .iter()
        .map(|track| (&track.track.0, (track.begin, track.end)))
        .collect();

    for (index, detector) in route.release_detectors.iter().enumerate() {
        let detector = infra_cache.detectors().get::<String>(detector).unwrap();
        let detector = detector.unwrap_detector();
        let track_range = track_ranges.get(&detector.track);
        if let Some(track_range) = track_range {
            if (track_range.0..=track_range.1).contains(&detector.position) {
                continue;
            }
        }

        res.push(InfraError::new_object_out_of_path(
            route,
            format!("release_detectors.{index}"),
            detector.get_ref(),
        ));
    }

    (res, context)
}

/// Check that all track sections are covered by a route
fn check_missing(
    infra_cache: &InfraCache,
    _: &Graph,
    context: Context,
) -> (Vec<InfraError>, Context) {
    let mut res = vec![];
    for track in infra_cache
        .track_sections()
        .keys()
        .filter(|e| !context.tracks_on_routes.contains(*e))
    {
        res.push(InfraError::new_missing_route(track));
    }

    (res, context)
}

#[cfg(test)]
mod tests {
    use crate::generated_data::error::routes::{
        check_entry_point_ref, check_exit_point_ref, check_missing, check_path,
        check_release_detectors_ref, check_switches_directions_ref,
    };
    use crate::infra_cache::tests::{
        create_detector_cache, create_route_cache, create_small_infra_cache,
    };
    use crate::infra_cache::Graph;
    use crate::schema::{Direction, OSRDObject, ObjectRef, ObjectType, Waypoint};

    use super::InfraError;

    #[test]
    fn invalid_ref_entry_point() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF_non_existing"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            Default::default(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_entry_point_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::BufferStop, "BF_non_existing");
        let infra_error = InfraError::new_invalid_reference(&route, "entry_point", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_release_detector_ref() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec!["Detector_non_existing".into()],
            Default::default(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_release_detectors_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::Detector, "Detector_non_existing");
        let infra_error = InfraError::new_invalid_reference(&route, "release_detectors.0", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref_exit_point() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("Detector_non_existing"),
            vec![],
            Default::default(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_exit_point_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::Detector, "Detector_non_existing");
        let infra_error = InfraError::new_invalid_reference(&route, "exit_point", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_switch_ref() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            [("no_switch".into(), "LEFT".into())].into(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_switches_directions_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::Switch, "no_switch");
        let infra_error =
            InfraError::new_invalid_reference(&route, "switches_directions.no_switch", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_switch_group() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            [("switch".into(), "NO_GROUP".into())].into(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_switches_directions_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_group(
            &route,
            "switches_directions.switch",
            "NO_GROUP",
            "point",
        );
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_path_1() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_detector("D1"),
            Direction::StartToStop,
            Waypoint::new_buffer_stop("BF3"),
            vec![],
            [("switch".into(), "LEFT".into())].into(), // Wrong direction
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_path(&route);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_path_2() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_detector("D1"),
            Direction::StopToStart, // Wrong direction
            Waypoint::new_buffer_stop("BF3"),
            vec![],
            [("switch".into(), "RIGHT".into())].into(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_path(&route);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_path_3() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_detector("D1"),
            Direction::StartToStop,
            Waypoint::new_buffer_stop("BF2"), // Wrong exit point
            vec![],
            [("switch".into(), "RIGHT".into())].into(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_path(&route);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_path_4() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_detector("D1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            Default::default(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_path(&route);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn release_detector_out_of_path() {
        let mut infra_cache = create_small_infra_cache();
        let detector = create_detector_cache("D2", "B", 255.);
        infra_cache.add(detector.clone());
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec!["D2".into()],
            Default::default(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_object_out_of_path(&route, "release_detectors.0", detector.get_ref());
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn switch_out_of_path() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            [("switch".into(), "RIGHT".into())].into(),
        );
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_object_out_of_path(
            &route,
            "switches_directions.switch",
            ObjectRef::new(ObjectType::Switch, "switch"),
        );
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn missing_routes() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        // Based on context the function should return an error for each track section
        let (errors, _) = check_missing(&infra_cache, &graph, ctx);
        assert_eq!(4, errors.len());
    }
}
