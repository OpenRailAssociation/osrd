use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::InfraError;
use crate::railjson::ObjectType;
use crate::{infra_cache::InfraCache, railjson::ObjectRef};
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let (errors, link_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/track_section_links_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&link_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, link_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut link_ids = vec![];

    for (link_id, link) in infra_cache.track_section_links.iter() {
        // Retrieve invalid refs

        for (track_ref, pos) in [
            (link.src.track.obj_id.clone(), "src"),
            (link.dst.track.obj_id.clone(), "dst"),
        ] {
            if !infra_cache.track_sections.contains_key(&track_ref) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_ref);
                let infra_error =
                    InfraError::new_invalid_reference(format!("{}.track", pos), obj_ref);
                errors.push(to_value(infra_error).unwrap());
                link_ids.push(link_id.clone());
            }
        }
    }

    (errors, link_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{
            create_small_infra_cache, create_track_endpoint, create_track_link_cache,
        },
        railjson::{Endpoint, ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn single_invalid_ref_dst() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_track_section_link(create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "C"),
            create_track_endpoint(Endpoint::Begin, "E"),
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("dst.track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("link_error", ids[0]);
    }

    #[test]
    fn double_invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_track_section_link(create_track_link_cache(
            "link_error",
            create_track_endpoint(Endpoint::End, "E"),
            create_track_endpoint(Endpoint::Begin, "F"),
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(2, errors.len());
        assert_eq!(2, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("src.track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("link_error", ids[0]);
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "F".into());
        let infra_error = InfraError::new_invalid_reference("dst.track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[1]);
        assert_eq!("link_error", ids[1]);
    }
}
