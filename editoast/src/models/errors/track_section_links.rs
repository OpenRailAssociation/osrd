use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use std::collections::HashMap;

use super::InfraError;
use crate::objects::{OSRDObject, ObjectType, TrackEndpoint};
use crate::{infra_cache::InfraCache, objects::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache);

    let mut link_ids = vec![];
    let mut errors = vec![];

    for error in infra_errors {
        link_ids.push(error.obj_id.clone());
        errors.push(to_value(error).unwrap());
    }

    let count = sql_query(include_str!("sql/track_section_links_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&link_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, link_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    let mut switch_cache = HashMap::<&TrackEndpoint, ObjectRef>::new();

    for switch in infra_cache.switches().values() {
        let switch = switch.unwrap_switch();
        for port in switch.ports.values() {
            switch_cache.insert(port, switch.get_ref());
        }
    }

    for (link_id, link) in infra_cache.track_section_links().iter() {
        let link = link.unwrap_track_section_link();

        // Retrieve invalid refs
        for (track_ref, pos) in [
            (link.src.track.obj_id.clone(), "src"),
            (link.dst.track.obj_id.clone(), "dst"),
        ] {
            if !infra_cache.track_sections().contains_key(&track_ref) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_ref);
                let infra_error = InfraError::new_invalid_reference(
                    link_id.clone(),
                    format!("{}.track", pos),
                    obj_ref,
                );
                errors.push(infra_error);
            }
        }

        if switch_cache.contains_key(&link.src) {
            errors.push(InfraError::new_overlapping_track_links(
                link_id.clone(),
                switch_cache.get(&link.src).unwrap().clone().to_owned(),
            ));
        } else {
            switch_cache.insert(&link.src, link.get_ref());
            switch_cache.insert(&link.dst, link.get_ref());
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{
            create_small_infra_cache, create_track_endpoint, create_track_link_cache,
        },
        objects::{Endpoint, ObjectRef, ObjectType},
    };

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn single_invalid_ref_dst() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "C"),
            create_track_endpoint(Endpoint::Begin, "E"),
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference("link_error", "dst.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn double_invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "E"),
            create_track_endpoint(Endpoint::Begin, "F"),
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(2, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference("link_error", "src.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "F");
        let infra_error = InfraError::new_invalid_reference("link_error", "dst.track", obj_ref);
        assert_eq!(infra_error, errors[1]);
    }

    #[test]
    fn link_over_switch() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "B"),
            create_track_endpoint(Endpoint::Begin, "C"),
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef {
            obj_type: ObjectType::Switch,
            obj_id: "switch".into(),
        };
        let infra_error = InfraError::new_overlapping_track_links("link_error", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn link_over_link() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "A"),
            create_track_endpoint(Endpoint::Begin, "B"),
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
    }
}
