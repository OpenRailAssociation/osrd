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
    let mut signal_ids = vec![];
    for (signal_id, track_ref) in infra_cache.signal_dependencies.iter() {
        if !infra_cache.track_sections.contains(track_ref) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, track_ref.into());
            let infra_error = InfraError::new_invalid_reference("track".into(), obj_ref);
            errors.push(to_value(infra_error).unwrap());
            signal_ids.push(signal_id.clone());
        }
    }

    let count = sql_query(include_str!("sql/signals_invalid_refs.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&signal_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, signal_ids.len());

    Ok(())
}
