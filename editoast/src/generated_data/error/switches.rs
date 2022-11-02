use std::collections::{HashMap, HashSet};

use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use crate::infra_cache::InfraCache;
use crate::schema::{InfraError, ObjectRef, ObjectType, SwitchCache, TrackEndpoint};
use diesel::result::Error as DieselError;
use serde_json::{to_value, Value};

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache);

    let errors: Vec<Value> = infra_errors
        .iter()
        .map(|error| to_value(error).unwrap())
        .collect();
    let count = sql_query(include_str!("sql/switches_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    let mut switch_cache = HashMap::<&TrackEndpoint, ObjectRef>::new();

    for switch in infra_cache.switches().values() {
        let switch = switch.unwrap_switch();

        // Retrieve invalid refs for track sections (ports)
        let infra_errors = check_invalid_ref_ports(infra_cache, switch);
        if !infra_errors.is_empty() {
            errors.extend(infra_errors);
            continue;
        }

        // retrieve invalid refs for switch type
        let infra_errors = check_invalid_ref_switch_type(infra_cache, switch);
        if !infra_errors.is_empty() {
            errors.extend(infra_errors);
            continue;
        }

        // TODO: change railjson schema to have a set instead of a list
        // in order to avoid doing it for each switch
        let infra_errors = check_match_ports_type(infra_cache, switch);
        if !infra_errors.is_empty() {
            errors.extend(infra_errors);
            continue;
        }

        // Check if the switch ports are not already used by another switch
        errors.extend(check_another_switch(&switch_cache, switch));

        let switch_ref = ObjectRef {
            obj_type: ObjectType::Switch,
            obj_id: switch.obj_id.clone(),
        };

        for port in switch.ports.values() {
            switch_cache.insert(port, switch_ref.clone());
        }
    }

    errors
}

pub fn check_invalid_ref_ports(infra_cache: &InfraCache, switch: &SwitchCache) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    for (port_name, port) in switch.ports.iter() {
        if !infra_cache.track_sections().contains_key(&port.track) {
            let obj_ref = ObjectRef::new(ObjectType::TrackSection, port.track.clone());
            infra_errors.push(InfraError::new_invalid_reference(
                switch,
                format!("ports.{port_name}.track"),
                obj_ref,
            ));
        }
    }
    infra_errors
}

/// Retrieve invalid switch type refs for switches
pub fn check_invalid_ref_switch_type(
    infra_cache: &InfraCache,
    switch: &SwitchCache,
) -> Vec<InfraError> {
    if !infra_cache.switch_types().contains_key(&switch.switch_type) {
        let obj_ref = ObjectRef::new(ObjectType::SwitchType, switch.switch_type.clone());
        vec![InfraError::new_invalid_reference(
            switch,
            "switch_type",
            obj_ref,
        )]
    } else {
        vec![]
    }
}

/// Check if switch ports match switch type ports
pub fn check_match_ports_type(infra_cache: &InfraCache, switch: &SwitchCache) -> Vec<InfraError> {
    let match_ports: HashSet<&String> = switch.ports.keys().collect();
    let switch_type = infra_cache
        .switch_types()
        .get(&switch.switch_type)
        .unwrap()
        .unwrap_switch_type();
    let original_ports: HashSet<&String> = switch_type.ports.iter().collect();
    if match_ports != original_ports {
        vec![InfraError::new_invalid_switch_ports(switch, "ports")]
    } else {
        vec![]
    }
}

/// Check if the switch ports are not already used by another switch
pub fn check_another_switch(
    switch_cache: &HashMap<&TrackEndpoint, ObjectRef>,
    switch: &SwitchCache,
) -> Vec<InfraError> {
    if let Some(port) = switch.ports.values().find(|p| switch_cache.contains_key(p)) {
        vec![InfraError::new_overlapping_switches(
            switch,
            switch_cache.get(port).unwrap().clone(),
        )]
    } else {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use crate::infra_cache::tests::{
        create_small_infra_cache, create_switch_cache_point, create_track_endpoint,
    };
    use crate::schema::{Endpoint, ObjectRef, ObjectType};

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn invalid_ref_track() {
        let mut infra_cache = create_small_infra_cache();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("BASE", create_track_endpoint(Endpoint::End, "E")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        );
        infra_cache.add(switch.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&switch, "ports.BASE.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref_switch_type() {
        let mut infra_cache = create_small_infra_cache();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("BASE", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "non_existing_switch_type".into(),
        );
        infra_cache.add(switch.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::SwitchType, "non_existing_switch_type");
        let infra_error = InfraError::new_invalid_reference(&switch, "switch_type", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn incorrect_ports() {
        let mut infra_cache = create_small_infra_cache();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("WRONG", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        );
        infra_cache.add(switch.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_switch_ports(&switch, "ports");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_switches() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_switch_cache_point(
            "SW_error".into(),
            ("BASE", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
    }
}
