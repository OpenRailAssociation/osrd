use diesel::PgConnection;
use std::collections::{HashMap, HashSet};

use diesel::sql_types::{Array, Integer, Json};
use diesel::{sql_query, RunQueryDsl};

use super::graph::Graph;
use crate::generated_data::error::ErrGenerator;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::InfraError;
use diesel::result::Error as DieselError;
use serde_json::{to_value, Value};

pub const SWITCH_TYPES_ERRORS: [ErrGenerator; 1] = [ErrGenerator::new(1, check_switch_types)];

pub fn insert_errors(
    infra_errors: Vec<InfraError>,
    conn: &PgConnection,
    infra_id: i32,
) -> Result<(), DieselError> {
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

/// Check unknown port name, duplicated group and unused port for switch_type
pub fn check_switch_types(switch_type: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let switch_type = switch_type.unwrap_switch_type();
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
                        dir,
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

    use crate::generated_data::error::graph::Graph;
    use crate::infra_cache;
    use crate::infra_cache::tests::{create_switch_connection, create_switch_type_cache};

    use super::check_switch_types;
    use super::InfraError;

    #[test]
    fn unknown_port_name() {
        let switch_type = create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("WRONG", "LEFT")],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE", "RIGHT")],
                ),
            ]),
        )
        .into();
        let errors = check_switch_types(
            &switch_type,
            &infra_cache::tests::create_small_infra_cache(),
            &Graph::load(&infra_cache::tests::create_small_infra_cache()),
        );
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_unknown_port_name(&switch_type, "groups.LEFT.0", "WRONG");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn duplicated_group() {
        let switch_type = create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("BASE", "LEFT")],
                ),
                (
                    "ERROR".into(),
                    vec![create_switch_connection("BASE", "LEFT")],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE", "RIGHT")],
                ),
            ]),
        )
        .into();
        let errors = check_switch_types(
            &switch_type,
            &infra_cache::tests::create_small_infra_cache(),
            &Graph::load(&infra_cache::tests::create_small_infra_cache()),
        );
        assert_eq!(1, errors.len());
    }

    #[test]
    fn unused_port() {
        let switch_type = create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([(
                "LEFT".into(),
                vec![create_switch_connection("BASE", "LEFT")],
            )]),
        )
        .into();
        let infra_cache = infra_cache::tests::create_small_infra_cache();
        let errors = check_switch_types(&switch_type, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_unused_port(&switch_type, "ports.2", "RIGHT");
        assert_eq!(infra_error, errors[0]);
    }
}
