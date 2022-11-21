use super::graph::Graph;
use crate::generated_data::error::ErrGenerator;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{
    Direction, InfraError, OSRDIdentified, OSRDObject, ObjectRef, ObjectType, PathEndpointField,
    Route, Waypoint,
};
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde_json::{to_value, Value};
use strum::IntoEnumIterator;

pub const ROUTE_ERRORS: [ErrGenerator; 5] = [
    ErrGenerator::new(1, check_empty),
    ErrGenerator::new(2, check_route_path),
    ErrGenerator::new(3, check_path_not_continuous),
    ErrGenerator::new(3, check_entry_exit_point_errors),
    ErrGenerator::new(3, check_detector_errors),
];

pub fn insert_errors(
    infra_errors: Vec<InfraError>,
    conn: &PgConnection,
    infra_id: i32,
) -> Result<(), DieselError> {
    let errors: Vec<Value> = infra_errors
        .iter()
        .map(|error| to_value(error).unwrap())
        .collect();
    let count = sql_query(include_str!("sql/routes_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}

/// Given an ObjectRef, retrieve the id and position of its track section
/// If the object type is not a detector or a buffer stop, return `None`
/// If there is an invalid reference, return `None`
fn get_object(object: &Waypoint, infra_cache: &InfraCache) -> Option<(String, f64)> {
    // let obj_id = &object.id;
    match object {
        Waypoint::Detector { id } => infra_cache
            .detectors()
            .get(id)
            .map(|d| d.unwrap_detector())
            .map(|d| (d.track.clone(), d.position)),
        Waypoint::BufferStop { id } => infra_cache
            .buffer_stops()
            .get(id)
            .map(|d| d.unwrap_buffer_stop())
            .map(|bs| (bs.track.clone(), bs.position)),
    }
}

/// Check if the id and the position of the endpoint referenced track
/// matches the id and the position of the object on the tracksection
fn check_matching_endpoint(
    route: &Route,
    expected_track: String,
    expected_position: f64,
    endpoint_field: PathEndpointField,
) -> Vec<InfraError> {
    let (track, pos) = endpoint_field.get_path_location(&route.path);

    if track != expected_track || pos != expected_position {
        vec![InfraError::new_path_does_not_match_endpoints(
            route,
            "path",
            expected_track,
            expected_position,
            endpoint_field,
        )]
    } else {
        vec![]
    }
}

///Check invalid DetectorRef and position
pub fn check_detector_errors(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let route = route.unwrap_route();
    for (index, release_detector) in route.release_detectors.iter().enumerate() {
        // Handle invalid ref for release detectors
        let (track, position) =
            match get_object(&Waypoint::new_detector(release_detector), infra_cache) {
                None => {
                    infra_errors.push(InfraError::new_invalid_reference(
                        route,
                        format!("release_detector.{index}"),
                        ObjectRef::new(ObjectType::Detector, release_detector.clone()),
                    ));
                    continue;
                }
                Some(e) => e,
            };

        // Handle release detectors outside from path

        let track_range = route.path.iter().find(|track_range| {
            track_range.track == track && (track_range.begin..=track_range.end).contains(&position)
        });
        if track_range.is_none() {
            infra_errors.push(InfraError::new_object_out_of_path(
                route,
                format!("release_detector.{index}"),
                position,
                track,
            ));
        }
    }
    infra_errors
}

/// Check if the entry and exit point of the route are valid
pub fn check_entry_exit_point_errors(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let route = route.unwrap_route();
    for path_endpoint in PathEndpointField::iter() {
        let (expected_track, expected_position) =
            match get_object(path_endpoint.get_route_endpoint(route), infra_cache) {
                None => {
                    infra_errors.push(InfraError::new_invalid_reference(
                        route,
                        path_endpoint.to_string(),
                        ObjectRef::new(route.entry_point.get_type(), route.entry_point.get_id()),
                    ));
                    continue;
                }
                Some(e) => e,
            };

        infra_errors.extend(check_matching_endpoint(
            route,
            expected_track,
            expected_position,
            path_endpoint,
        ));
    }
    infra_errors
}

/// Check if the path is continuous
pub fn check_path_not_continuous(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    graph: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let route = route.unwrap_route();
    for (index, (prev, next)) in route.path.iter().zip(route.path.iter().skip(1)).enumerate() {
        // TODO : differentiate errors caused by range and topology
        let infra_error =
            InfraError::new_path_is_not_continuous(route, format!("path.{}", index + 1));

        // path continuous between 2 trackrange on a same track
        if prev.track == next.track {
            if prev.direction != next.direction {
                infra_errors.push(infra_error);
                continue;
            }

            if (prev.direction == Direction::StartToStop && prev.end != next.begin)
                || (prev.direction == Direction::StopToStart && prev.begin != next.end)
            {
                infra_errors.push(infra_error);
            }

            continue;
        }

        // check if two paths are connected (topolgy)
        let prev_endpoint = prev.get_end();
        let next_endpoint = next.get_begin();

        if graph
            .get_neighbours(&prev_endpoint)
            .map_or(true, |set| !set.contains(&next_endpoint))
        {
            infra_errors.push(infra_error);
            continue;
        }

        // check for the ranges
        let track_cache = infra_cache
            .track_sections()
            .get(&prev.track)
            .unwrap()
            .unwrap_track_section();
        if (prev.direction == Direction::StartToStop && prev.end != track_cache.length)
            || (prev.direction == Direction::StopToStart && prev.begin != 0.0)
        {
            infra_errors.push(infra_error);
            continue;
        }

        let track_cache = infra_cache
            .track_sections()
            .get(&next.track)
            .unwrap()
            .unwrap_track_section();
        if (next.direction == Direction::StartToStop && next.begin != 0.0)
            || (next.direction == Direction::StopToStart && next.end != track_cache.length)
        {
            infra_errors.push(infra_error);
        }
    }
    infra_errors
}

/// Check if a route has a path
pub fn check_empty(route: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let route = route.unwrap_route();
    if route.path.is_empty() {
        vec![InfraError::new_empty_path(route, "path")]
    } else {
        vec![]
    }
}
/// Retrieve invalid ref and out of range errors for routes
pub fn check_route_path(
    route: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let route = route.unwrap_route();
    for (index, path) in route.path.iter().enumerate() {
        let track_id = &path.track;
        if !infra_cache.track_sections().contains_key(track_id) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
            infra_errors.push(InfraError::new_invalid_reference(
                route,
                format!("path.{index}"),
                obj_ref,
            ));
            continue;
        }
        let track_cache = infra_cache
            .track_sections()
            .get(track_id)
            .unwrap()
            .unwrap_track_section();
        for (pos, field) in [(path.begin, "begin"), (path.end, "end")] {
            if !(0.0..=track_cache.length).contains(&pos) {
                infra_errors.push(InfraError::new_out_of_range(
                    route,
                    format!("path.{index}.{field}"),
                    pos,
                    [0.0, track_cache.length],
                ));
            }
        }
    }
    infra_errors
}

#[cfg(test)]
mod tests {
    use crate::generated_data::error::graph::Graph;
    use crate::infra_cache::tests::{
        create_detector_cache, create_route_cache, create_small_infra_cache,
    };
    use crate::infra_cache::ObjectCache;
    use crate::schema::{Direction, ObjectRef, ObjectType, PathEndpointField, Waypoint};

    use super::check_detector_errors;
    use super::check_entry_exit_point_errors;
    use super::check_matching_endpoint;
    use super::check_path_not_continuous;
    use super::check_route_path;
    use super::get_object;
    use super::InfraError;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("E", 0., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let errors = check_route_path(&route, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&route, "path.1", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 600., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let errors = check_route_path(&route, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_out_of_range(&route, "path.0.end", 600., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref_entry_point() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop {
                id: "BF_non_existing".into(),
            },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let errors =
            check_entry_exit_point_errors(&route, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::BufferStop, "BF_non_existing");
        let infra_error = InfraError::new_invalid_reference(&route, "\"entry_point\"", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn path_match_endpoint() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 40., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        let route = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            error_path,
        );
        infra_cache.add(route.clone());

        let (expected_track, expected_position) = get_object(
            PathEndpointField::EntryPoint.get_route_endpoint(&route),
            &infra_cache,
        )
        .unwrap();

        let errors = check_matching_endpoint(
            &route,
            expected_track,
            expected_position,
            PathEndpointField::EntryPoint,
        );

        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_path_does_not_match_endpoints(
            &route,
            "path",
            "A".into(),
            20.,
            PathEndpointField::EntryPoint,
        );
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref_release_detector() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec!["non_existing_D".into()],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let errors = check_detector_errors(&route, &infra_cache, &Graph::load(&infra_cache));

        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_reference(
            &route,
            "release_detector.0",
            ObjectRef::new(ObjectType::Detector, "non_existing_D"),
        );
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_path() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        infra_cache.add(create_detector_cache("D2", "C", 250.));
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec!["D2".into()],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let errors = check_detector_errors(&route, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_object_out_of_path(&route, "release_detector.0", 250., "C");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn path_not_continuous_1() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("B", 100., 250., Direction::StartToStop),
        ];
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_path_not_continuous(&route, &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_path_is_not_continuous(&route, "path.1");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn path_not_continuous_2() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 250., Direction::StartToStop),
            ("A", 300., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_path_not_continuous(&route, &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_path_is_not_continuous(&route, "path.1");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn path_not_continuous_3() {
        let mut infra_cache = create_small_infra_cache();
        let error_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("C", 0., 250., Direction::StartToStop),
        ];
        infra_cache.add(create_detector_cache("D2", "C", 250.));
        let route: ObjectCache = create_route_cache(
            "R_error",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D2".into() },
            vec![],
            error_path,
        )
        .into();
        infra_cache.add(route.clone());
        let graph = Graph::load(&infra_cache);
        let errors = check_path_not_continuous(&route, &infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_path_is_not_continuous(&route, "path.1");
        assert_eq!(infra_error, errors[0]);
    }
}
