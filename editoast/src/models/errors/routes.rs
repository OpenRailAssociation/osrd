use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::InfraError;
use crate::railjson::ObjectType;
use crate::{infra_cache::InfraCache, railjson::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn generate_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let mut errors = vec![];
    let mut route_ids = vec![];
    for (route_id, route) in infra_cache.routes.iter() {
        // TODO : empty path = error

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
            if !(0.0..=track_cache.length).contains(&path.begin) {
                let infra_error = InfraError::new_out_of_range(
                    format!("path.{}.begin", index),
                    path.begin,
                    [0.0, track_cache.length],
                );
                errors.push(to_value(infra_error).unwrap());
                route_ids.push(route_id.clone());
            }
            if !(0.0..=track_cache.length).contains(&path.end) {
                let infra_error = InfraError::new_out_of_range(
                    format!("path.{}.end", index),
                    path.begin,
                    [0.0, track_cache.length],
                );
                errors.push(to_value(infra_error).unwrap());
                route_ids.push(route_id.clone());
            }
        }

        for (index, release_detector) in route.release_detectors.iter().enumerate() {
            // Handle invalid ref for release detectors
            let obj_id = &release_detector.obj_id;
            let track_ref = match release_detector.obj_type {
                ObjectType::Detector => infra_cache
                    .detectors
                    .get(obj_id)
                    .map(|d| (d.track.clone(), d.position)),
                ObjectType::BufferStop => infra_cache
                    .buffer_stops
                    .get(obj_id)
                    .map(|bs| (bs.track.clone(), bs.position)),
                _ => None,
            };
            let (track, position) = match track_ref {
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
