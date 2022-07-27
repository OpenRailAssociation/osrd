use super::graph::Graph;
use super::InfraError;
use crate::infra_cache::InfraCache;
use crate::railjson::ObjectType;
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde_json::to_value;

pub fn generate_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
    graph: &Graph,
) -> Result<(), DieselError> {
    let mut errors = vec![];
    let mut track_ids = vec![];

    for track_id in infra_cache.track_sections.keys() {
        if let Some(e) = infra_cache.track_sections_refs.get(track_id) {
            if e.iter()
                .find(|obj_ref| obj_ref.obj_type == ObjectType::Route)
                == None
            {
                errors.push(to_value(InfraError::new_missing_route()).unwrap());
                track_ids.push((*track_id).clone());
            }
        }
    }

    // topological error : no buffer stop on graph leaves

    for (track_id, track_cache) in infra_cache.track_sections.iter() {
        if graph.get_neighbours(&track_cache.get_begin()).is_none()
            || graph.get_neighbours(&track_cache.get_end()).is_none()
        {
            let track_refs = infra_cache.track_sections_refs.get(track_id);

            if track_refs.is_none()
                || track_refs
                    .unwrap()
                    .iter()
                    .any(|x| x.obj_type == ObjectType::BufferStop)
            {
                let infra_error = InfraError::new_no_buffer_stop("buffer_stop");
                errors.push(to_value(infra_error).unwrap());
                track_ids.push(track_id.clone());
            }
        }
    }

    let count = sql_query(include_str!("sql/track_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&track_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, track_ids.len());

    Ok(())
}
