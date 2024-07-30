use std::collections::HashMap;
use std::collections::HashSet;

use super::GlobalErrorGenerator;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::Waypoint;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDObject;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<Context>; 5] = [
    ObjectErrorGenerator::new(1, check_entry_point_ref),
    ObjectErrorGenerator::new(1, check_exit_point_ref),
    ObjectErrorGenerator::new(1, check_release_detectors_ref),
    ObjectErrorGenerator::new(1, check_track_nodes_directions_ref),
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
fn check_track_nodes_directions_ref(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let route = route.unwrap_route();
    let mut res = vec![];
    for (track_node_id, direction) in route.track_nodes_directions.iter() {
        if !infra_cache.track_nodes().contains_key::<String>(track_node_id) {
            res.push(InfraError::new_invalid_reference(
                route,
                format!("track_nodes_directions.{track_node_id}"),
                ObjectRef::new(ObjectType::TrackNode, track_node_id),
            ));
            continue;
        }
        let track_node_type = &infra_cache
            .track_nodes()
            .get::<String>(track_node_id)
            .unwrap()
            .unwrap_track_node()
            .track_node_type;
        if let Some(track_node_type) = infra_cache.track_node_types().get(track_node_type) {
            let track_node_type = track_node_type.unwrap_track_node_type();
            if !track_node_type.groups.contains_key(direction) {
                res.push(InfraError::new_invalid_group(
                    route,
                    format!("track_nodes_directions.{track_node_id}"),
                    direction,
                    track_node_type.get_id(),
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

    let route_path = match infra_cache.compute_track_ranges_on_route(route, graph) {
        Some(path) => path,
        None => return (vec![InfraError::new_invalid_path(route)], context),
    };

    // Add tracks on the route to the context
    let tracks_on_route = route_path
        .track_ranges
        .iter()
        .map(|track| (*track.track).clone());
    context.tracks_on_routes.extend(tracks_on_route);

    let track_nodes_hashset: HashSet<Identifier> = HashSet::from_iter(
        route_path
            .track_nodes_directions
            .iter()
            .map(|(k, _)| k.clone()),
    );
    // Search for track_nodes out of the path
    let mut res = vec![];
    for track_node in route.track_nodes_directions.keys() {
        if !track_nodes_hashset.contains(track_node) {
            res.push(InfraError::new_object_out_of_path(
                route,
                format!("track_nodes_directions.{track_node}"),
                ObjectRef::new(ObjectType::TrackNode, track_node),
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
    use super::InfraError;
    use crate::generated_data::error::routes::check_entry_point_ref;
    use crate::generated_data::error::routes::check_exit_point_ref;
    use crate::generated_data::error::routes::check_missing;
    use crate::generated_data::error::routes::check_path;
    use crate::generated_data::error::routes::check_release_detectors_ref;
    use crate::generated_data::error::routes::check_track_nodes_directions_ref;
    use crate::infra_cache::tests::create_detector_cache;
    use crate::infra_cache::tests::create_route_cache;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::Graph;
    use editoast_schemas::infra::Direction;
    use editoast_schemas::infra::Waypoint;
    use editoast_schemas::primitives::OSRDObject;
    use editoast_schemas::primitives::ObjectRef;
    use editoast_schemas::primitives::ObjectType;

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
        infra_cache.add(route.clone()).unwrap();
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
        infra_cache.add(route.clone()).unwrap();
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
        infra_cache.add(route.clone()).unwrap();
        let graph = Graph::load(&infra_cache);
        let errors = check_exit_point_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::Detector, "Detector_non_existing");
        let infra_error = InfraError::new_invalid_reference(&route, "exit_point", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_track_node_ref() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            [("no_track_node".into(), "A_B1".into())].into(),
        );
        infra_cache.add(route.clone()).unwrap();
        let graph = Graph::load(&infra_cache);
        let errors = check_track_nodes_directions_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackNode, "no_track_node");
        let infra_error =
            InfraError::new_invalid_reference(&route, "track_nodes_directions.no_track_node", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_track_node_group() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            [("track_node".into(), "NO_GROUP".into())].into(),
        );
        infra_cache.add(route.clone()).unwrap();
        let graph = Graph::load(&infra_cache);
        let errors = check_track_nodes_directions_ref(&route.clone().into(), &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_group(
            &route,
            "track_nodes_directions.track_node",
            "NO_GROUP",
            "point_switch",
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
            [("track_node".into(), "A_B1".into())].into(), // Wrong direction
        );
        infra_cache.add(route.clone()).unwrap();
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
            [("track_node".into(), "A_B2".into())].into(),
        );
        infra_cache.add(route.clone()).unwrap();
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
            [("track_node".into(), "A_B2".into())].into(),
        );
        infra_cache.add(route.clone()).unwrap();
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
        infra_cache.add(route.clone()).unwrap();
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
        infra_cache.add(detector.clone()).unwrap();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec!["D2".into()],
            [("link".into(), "LINK".into())].into(),
        );
        infra_cache.add(route.clone()).unwrap();
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_object_out_of_path(&route, "release_detectors.0", detector.get_ref());
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn track_node_out_of_path() {
        let mut infra_cache = create_small_infra_cache();
        let route = create_route_cache(
            "ErrorRoute",
            Waypoint::new_buffer_stop("BF1"),
            Direction::StartToStop,
            Waypoint::new_detector("D1"),
            vec![],
            [
                ("link".into(), "LINK".into()),
                ("track_node".into(), "A_B2".into()),
            ]
            .into(),
        );
        infra_cache.add(route.clone()).unwrap();
        let graph = Graph::load(&infra_cache);
        let ctx = Default::default();
        let (errors, _) = check_path(&route.clone().into(), &infra_cache, &graph, ctx);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_object_out_of_path(
            &route,
            "track_nodes_directions.track_node",
            ObjectRef::new(ObjectType::TrackNode, "track_node"),
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
