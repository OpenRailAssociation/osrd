use std::collections::HashSet;

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
    let (errors, switch_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/switches_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&switch_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, switch_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut switch_ids = vec![];

    for (switch_id, switch) in infra_cache.switches.iter() {
        // Retrieve invalid refs for track sections (ports)
        for (port_name, port) in switch.ports.iter() {
            if !infra_cache.track_sections.contains_key(&port.track.obj_id) {
                let obj_ref = ObjectRef::new(ObjectType::TrackSection, port.track.obj_id.clone());
                let infra_error = InfraError::new_invalid_reference(
                    format!("ports.{}.track", port_name),
                    obj_ref,
                );
                errors.push(to_value(infra_error).unwrap());
                switch_ids.push(switch_id.clone());
            }
        }

        // retrieve invalid refs for switch type
        if !infra_cache.switch_types.contains_key(&switch.switch_type) {
            let obj_ref = ObjectRef::new(ObjectType::SwitchType, switch.switch_type.clone());
            let infra_error = InfraError::new_invalid_reference("switch_type", obj_ref);
            errors.push(to_value(infra_error).unwrap());
            switch_ids.push(switch_id.clone());
            continue;
        }

        // TODO: change railjson schema to have a set instead of a list
        // in order to avoid doing it for each switch
        let match_ports: HashSet<&String> = switch.ports.keys().collect();
        let switch_type = infra_cache.switch_types.get(&switch.switch_type).unwrap();
        let original_ports: HashSet<&String> = switch_type.ports.iter().collect();
        // check if switch ports match switch type ports
        if match_ports != original_ports {
            let infra_error = InfraError::new_invalid_switch_ports("ports");
            errors.push(to_value(infra_error).unwrap());
            switch_ids.push(switch_id.clone());
        }
    }

    (errors, switch_ids)
}

#[cfg(test)]
mod tests {
    use crate::{
        infra_cache::tests::{
            create_small_infra_cache, create_switch_cache_point, create_track_endpoint,
        },
        railjson::{Endpoint, ObjectRef, ObjectType},
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref_track() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_switch(create_switch_cache_point(
            "SW_error".into(),
            ("BASE", create_track_endpoint(Endpoint::End, "E")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E".into());
        let infra_error = InfraError::new_invalid_reference("ports.BASE.track", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("SW_error", ids[0]);
    }

    #[test]
    fn invalid_ref_switch_type() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_switch(create_switch_cache_point(
            "SW_error".into(),
            ("BASE", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "non_existing_switch_type".into(),
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let obj_ref = ObjectRef::new(ObjectType::SwitchType, "non_existing_switch_type".into());
        let infra_error = InfraError::new_invalid_reference("switch_type", obj_ref);
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("SW_error", ids[0]);
    }

    #[test]
    fn incorrect_ports() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_switch(create_switch_cache_point(
            "SW_error".into(),
            ("WRONG", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_invalid_switch_ports("ports");
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("SW_error", ids[0]);
    }
}
