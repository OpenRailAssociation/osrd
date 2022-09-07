use super::graph::Graph;
use super::InfraError;
use crate::infra_cache::InfraCache;
use crate::objects::ObjectType;
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
    let infra_errors = generate_errors(infra_cache, graph);

    let mut track_ids = vec![];
    let mut errors = vec![];

    for error in infra_errors {
        track_ids.push(error.obj_id.clone());
        errors.push(to_value(error).unwrap());
    }

    let count = sql_query(include_str!("sql/track_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&track_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, track_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache, graph: &Graph) -> Vec<InfraError> {
    let mut errors = vec![];

    for track_id in infra_cache.track_sections.keys() {
        if let Some(e) = infra_cache.track_sections_refs.get(track_id) {
            if !e
                .iter()
                .any(|obj_ref| obj_ref.obj_type == ObjectType::Route)
            {
                errors.push(InfraError::new_missing_route(track_id.clone()));
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
                let infra_error = InfraError::new_no_buffer_stop(track_id.clone(), "buffer_stop");
                errors.push(infra_error);
            }
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::create_small_infra_cache,
        models::errors::graph::Graph,
        objects::{ObjectRef, ObjectType},
    };

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn missing_route() {
        let mut infra_cache = create_small_infra_cache();
        let obj_ref = ObjectRef::new(ObjectType::Route, "R1");
        infra_cache.apply_delete(&obj_ref);
        let graph = Graph::load(&infra_cache);
        let errors = generate_errors(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_missing_route("A");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn missing_buffer_stop() {
        let mut infra_cache = create_small_infra_cache();
        let obj_ref = ObjectRef::new(ObjectType::BufferStop, "BF1");
        infra_cache.apply_delete(&obj_ref);
        let graph = Graph::load(&infra_cache);
        let errors = generate_errors(&infra_cache, &graph);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_no_buffer_stop("A", "buffer_stop");
        assert_eq!(infra_error, errors[0]);
    }
}
