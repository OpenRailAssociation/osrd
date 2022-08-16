use super::graph::Graph;
use super::InfraError;
use crate::infra_cache::InfraCache;
use crate::railjson::ObjectType;
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
    graph: &Graph,
) -> Result<(), DieselError> {
    let (errors, track_ids) = generate_errors(infra_cache, graph);

    let count = sql_query(include_str!("sql/track_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&track_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, track_ids.len());

    Ok(())
}

pub fn generate_errors(
    infra_cache: &InfraCache,
    graph: &Graph,
) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut track_ids = vec![];

    for track_id in infra_cache.track_sections.keys() {
        if let Some(e) = infra_cache.track_sections_refs.get(track_id) {
            if !e
                .iter()
                .any(|obj_ref| obj_ref.obj_type == ObjectType::Route)
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
                || !track_refs
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
    (errors, track_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::create_small_infra_cache,
        models::errors::graph::Graph,
        railjson::{ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn missing_route() {
        let mut infra_cache = create_small_infra_cache();
        let obj_ref = ObjectRef::new(ObjectType::Route, "R1".into());
        infra_cache.apply_delete(&obj_ref);
        let graph = Graph::load(&infra_cache);
        let (errors, ids) = generate_errors(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_missing_route();
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("A", ids[0]);
    }

    #[test]
    fn missing_buffer_stop() {
        let mut infra_cache = create_small_infra_cache();
        let obj_ref = ObjectRef::new(ObjectType::BufferStop, "BF1".into());
        infra_cache.apply_delete(&obj_ref);
        let graph = Graph::load(&infra_cache);
        let (errors, ids) = generate_errors(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_no_buffer_stop("buffer_stop");
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("A", ids[0]);
    }
}
