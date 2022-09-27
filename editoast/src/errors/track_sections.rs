use super::graph::Graph;
use crate::infra_cache::InfraCache;
use crate::schema::{InfraError, ObjectType};
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde_json::{to_value, Value};

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
    graph: &Graph,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache, graph);

    let errors: Vec<Value> = infra_errors
        .iter()
        .map(|error| to_value(error).unwrap())
        .collect();

    let count = sql_query(include_str!("sql/track_sections_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache, graph: &Graph) -> Vec<InfraError> {
    let mut errors = vec![];

    for (track_id, track) in infra_cache.track_sections().iter() {
        if let Some(e) = infra_cache.track_sections_refs.get(track_id) {
            if !e
                .iter()
                .any(|obj_ref| obj_ref.obj_type == ObjectType::Route)
            {
                errors.push(InfraError::new_missing_route(track));
            }
        }
    }

    // topological error : no buffer stop on graph leaves
    for (track_id, track) in infra_cache.track_sections().iter() {
        let track_cache = track.unwrap_track_section();
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
                let infra_error = InfraError::new_no_buffer_stop(track, "buffer_stop");
                errors.push(infra_error);
            }
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use crate::errors::graph::Graph;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::schema::{ObjectRef, ObjectType};

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
        let infra_error =
            InfraError::new_missing_route(infra_cache.track_sections().get("A").unwrap());
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
        let infra_error = InfraError::new_no_buffer_stop(
            infra_cache.track_sections().get("A").unwrap(),
            "buffer_stop",
        );
        assert_eq!(infra_error, errors[0]);
    }
}
