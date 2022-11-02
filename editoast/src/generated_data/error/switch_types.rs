use diesel::PgConnection;
use std::collections::{HashMap, HashSet};

use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, RunQueryDsl};

use crate::infra_cache::InfraCache;
use crate::schema::{InfraError, SwitchType};
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
    let count = sql_query(include_str!("sql/switch_types_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, infra_errors.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for switch_type in infra_cache.switch_types().values() {
        let switch_type = switch_type.unwrap_switch_type();
        errors.extend(check_switch_types(switch_type));
    }
    errors
}

/// Check unknown port name, duplicated group and unused port for switch_type
pub fn check_switch_types(switch_type: &SwitchType) -> Vec<InfraError> {
    let mut used_port = HashSet::new();
    let mut duplicate_port_connection = HashMap::new();
    let mut infra_errors = vec![];
    for (group_name, group) in switch_type.groups.iter() {
        for (pos, connection) in group.iter().enumerate() {
            for dir in [&connection.src, &connection.dst] {
                if !switch_type.ports.contains(dir) {
                    infra_errors.push(InfraError::new_unknown_port_name(
                        switch_type,
                        format!("groups.{group_name}.{pos}"),
                        dir.clone(),
                    ));
                }
                used_port.insert(dir);
            }
        }
        if let Some(duplicate_group) = duplicate_port_connection.get(group) {
            infra_errors.push(InfraError::new_duplicated_group(
                switch_type,
                format!("groups.{group_name}"),
                format!("groups.{duplicate_group}"),
            ));
        } else {
            duplicate_port_connection.insert(group, group_name);
        }
    }
    for (pos, port) in switch_type
        .ports
        .iter()
        .enumerate()
        .filter(|(_, ports)| !used_port.contains(ports))
    {
        infra_errors.push(InfraError::new_unused_port(
            switch_type,
            format!("ports.{pos}"),
            port,
        ));
    }
    infra_errors
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::infra_cache::tests::{
        create_small_infra_cache, create_switch_connection, create_switch_type_cache,
    };

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn unknown_port_name() {
        let mut infra_cache = create_small_infra_cache();
        let switch_type = create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("WRONG".into(), "LEFT".into())],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE".into(), "RIGHT".into())],
                ),
            ]),
        );
        infra_cache.add(switch_type.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_unknown_port_name(&switch_type, "groups.LEFT.0", "WRONG".into());
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn duplicated_group() {
        let mut infra_cache = create_small_infra_cache();
        let switch_type = create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("BASE".into(), "LEFT".into())],
                ),
                (
                    "ERROR".into(),
                    vec![create_switch_connection("BASE".into(), "LEFT".into())],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE".into(), "RIGHT".into())],
                ),
            ]),
        );
        infra_cache.add(switch_type);
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
    }

    #[test]
    fn unused_port() {
        let mut infra_cache = create_small_infra_cache();
        let switch_type = create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([(
                "LEFT".into(),
                vec![create_switch_connection("BASE".into(), "LEFT".into())],
            )]),
        );
        infra_cache.add(switch_type.clone());
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_unused_port(&switch_type, "ports.2", "RIGHT");
        assert_eq!(infra_error, errors[0]);
    }
}
