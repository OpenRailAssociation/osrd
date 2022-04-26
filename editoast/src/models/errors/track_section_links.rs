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
    let mut link_ids = vec![];

    for (link_id, link) in infra_cache.track_section_links.iter() {
        // Retrieve invalid refs
        if !infra_cache.track_sections.contains_key(&link.src) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, link.src.clone());
            let infra_error = InfraError::new_invalid_reference("src.track".into(), obj_ref);
            errors.push(to_value(infra_error).unwrap());
            link_ids.push(link_id.clone());
        }

        if !infra_cache.track_sections.contains_key(&link.dst) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, link.dst.clone());
            let infra_error = InfraError::new_invalid_reference("dst.track".into(), obj_ref);
            errors.push(to_value(infra_error).unwrap());
            link_ids.push(link_id.clone());
        }
    }

    let count = sql_query(include_str!("sql/track_section_links_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&link_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, link_ids.len());

    Ok(())
}
