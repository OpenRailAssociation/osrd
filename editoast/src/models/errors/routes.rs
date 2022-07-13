use std::fmt;

use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use strum_macros::EnumIter;

use super::InfraError;
use crate::railjson::{Direction, DirectionalTrackRange, ObjectType, Route};
use crate::{infra_cache::InfraCache, railjson::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

/// Represent the entry or exit point of a path
#[derive(Serialize, Deserialize, Debug, Clone, Copy, EnumIter)]
#[serde(deny_unknown_fields)]
pub enum PathEndpointField {
    #[serde(rename = "entry_point")]
    EntryPoint,
    #[serde(rename = "exit_point")]
    ExitPoint,
}

impl PathEndpointField {
    /// Given a path, retrieve track id and position offset of the path endpoint location
    pub fn get_path_location(&self, path: &[DirectionalTrackRange]) -> (String, f64) {
        let track_range = match self {
            PathEndpointField::EntryPoint => path.first().unwrap(),
            PathEndpointField::ExitPoint => path.last().unwrap(),
        };

        let pos = match (self, &track_range.direction) {
            (PathEndpointField::EntryPoint, Direction::StartToStop) => track_range.begin,
            (PathEndpointField::EntryPoint, Direction::StopToStart) => track_range.end,
            (PathEndpointField::ExitPoint, Direction::StartToStop) => track_range.end,
            (PathEndpointField::ExitPoint, Direction::StopToStart) => track_range.begin,
        };

        (track_range.track.obj_id.clone(), pos)
    }

    pub fn get_route_endpoint<'a>(&self, route: &'a Route) -> &'a ObjectRef {
        match self {
            PathEndpointField::EntryPoint => &route.entry_point,
            PathEndpointField::ExitPoint => &route.exit_point,
        }
    }
}

impl fmt::Display for PathEndpointField {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", serde_json::to_string(self).unwrap())
    }
}

/// Given an ObjectRef, retrieve the id and position of its track section
/// If the object type is not a detector or a buffer stop, return `None`
/// If there is an invalid reference, return `None`
fn get_object(object: &ObjectRef, infra_cache: &InfraCache) -> Option<(String, f64)> {
    let obj_id = &object.obj_id;
    match object.obj_type {
        ObjectType::Detector => infra_cache
            .detectors
            .get(obj_id)
            .map(|d| (d.track.clone(), d.position)),
        ObjectType::BufferStop => infra_cache
            .buffer_stops
            .get(obj_id)
            .map(|bs| (bs.track.clone(), bs.position)),
        _ => None,
    }
}

/// Check if the id and the position of the endpoint referenced track
/// matches the id and the position of the object on the tracksection
fn get_matching_endpoint_error(
    path: &[DirectionalTrackRange],
    expected_track: String,
    expected_position: f64,
    endpoint_field: PathEndpointField,
) -> Option<InfraError> {
    let (track, pos) = endpoint_field.get_path_location(path);

    if track != expected_track || pos != expected_position {
        Some(InfraError::new_path_does_not_match_endpoints(
            "path".into(),
            expected_track,
            expected_position,
            endpoint_field,
        ))
    } else {
        None
    }
}

pub fn generate_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let mut errors = vec![];
    let mut route_ids = vec![];
    for (route_id, route) in infra_cache.routes.iter() {
        if route.path.is_empty() {
            let infra_error = InfraError::new_empty_path("path".into());
            errors.push(to_value(infra_error).unwrap());
            route_ids.push(route_id.clone());
            continue;
        }

        for (index, path) in route.path.iter().enumerate() {
            // Retrieve invalid refs
            let track_id = &path.track.obj_id;
            if !infra_cache.track_sections.contains_key(track_id) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_id.clone());
                let infra_error =
                    InfraError::new_invalid_reference(format!("path.{}", index), obj_ref);
                errors.push(to_value(infra_error).unwrap());
                route_ids.push(route_id.clone());
                continue;
            }

            let track_cache = infra_cache.track_sections.get(track_id).unwrap();
            // Retrieve out of range
            for (pos, field) in [(path.begin, "begin"), (path.end, "end")] {
                if !(0.0..=track_cache.length).contains(&pos) {
                    let infra_error = InfraError::new_out_of_range(
                        format!("path.{}.{}", index, field),
                        pos,
                        [0.0, track_cache.length],
                    );
                    errors.push(to_value(infra_error).unwrap());
                    route_ids.push(route_id.clone());
                }
            }
        }

        // Retrieve errors on entry and exit point
        for path_endpoint in PathEndpointField::iter() {
            let (expected_track, expected_position) =
                match get_object(path_endpoint.get_route_endpoint(route), infra_cache) {
                    None => {
                        let error = InfraError::new_invalid_reference(
                            path_endpoint.to_string(),
                            route.entry_point.clone(),
                        );
                        errors.push(to_value(error).unwrap());
                        route_ids.push(route_id.clone());
                        continue;
                    }
                    Some(e) => e,
                };

            if let Some(error) = get_matching_endpoint_error(
                &route.path,
                expected_track,
                expected_position,
                PathEndpointField::EntryPoint,
            ) {
                errors.push(to_value(error).unwrap());
                route_ids.push(route_id.clone());
            }
        }

        for (index, release_detector) in route.release_detectors.iter().enumerate() {
            // Handle invalid ref for release detectors
            let (track, position) = match get_object(release_detector, infra_cache) {
                None => {
                    let error = InfraError::new_invalid_reference(
                        format!("release_detector.{}", index),
                        release_detector.clone(),
                    );
                    errors.push(to_value(error).unwrap());
                    route_ids.push(route_id.clone());
                    continue;
                }
                Some(e) => e,
            };

            // Handle release detectors outside from path
            let track_range = route.path.iter().find(|track_range| {
                track_range.track.obj_id == track
                    && (track_range.begin..=track_range.end).contains(&position)
            });
            if track_range.is_none() {
                let error = InfraError::new_object_out_of_path(
                    format!("release_detector.{}", index),
                    position,
                    track,
                );
                errors.push(to_value(error).unwrap());
                route_ids.push(route_id.clone());
            }
        }
    }

    let count = sql_query(include_str!("sql/routes_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&route_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, route_ids.len());

    Ok(())
}
