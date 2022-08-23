use std::collections::{HashMap, HashSet};

use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use super::InfraError;
use crate::infra_cache::InfraCache;
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let (errors, switch_type_ids) = generate_errors(infra_cache);

    let count = sql_query(include_str!("sql/switch_types_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&switch_type_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, switch_type_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> (Vec<serde_json::Value>, Vec<String>) {
    let mut errors = vec![];
    let mut switch_type_ids = vec![];

    for (switch_type_id, switch_type) in infra_cache.switch_types.iter() {
        let mut used_port = HashSet::new();
        let mut duplicate_port_connection = HashMap::new();

        for (group_name, group) in switch_type.groups.iter() {
            for (pos, connection) in group.iter().enumerate() {
                for dir in [&connection.src, &connection.dst] {
                    if !switch_type.ports.contains(dir) {
                        let infra_error = InfraError::new_unknown_port_name(
                            format!("groups.{}.{}", group_name, pos),
                            dir.clone(),
                        );
                        errors.push(to_value(infra_error).unwrap());
                        switch_type_ids.push(switch_type_id.clone());
                    }
                    used_port.insert(dir);
                }
            }

            if let Some(duplicate_group) = duplicate_port_connection.get(group) {
                let infra_error = InfraError::new_duplicated_group(
                    format!("groups.{}", group_name),
                    format!("groups.{}", duplicate_group),
                );
                errors.push(to_value(infra_error).unwrap());
                switch_type_ids.push(switch_type_id.clone());
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
            let infra_error = InfraError::new_unused_port(format!("ports.{}", pos), port.into());
            errors.push(to_value(infra_error).unwrap());
            switch_type_ids.push(switch_type_id.clone());
        }
    }

    (errors, switch_type_ids)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::infra_cache::tests::{
        create_small_infra_cache, create_switch_connection, create_switch_type_point,
    };
    use serde_json::to_value;

    use super::generate_errors;
    use super::InfraError;

    #[test]
    fn unknown_port_name() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_switch_type(create_switch_type_point(
            "ST_error",
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
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_unknown_port_name("groups.LEFT.0", "WRONG".into());
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("ST_error", ids[0]);
    }

    #[test]
    fn duplicated_group() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_switch_type(create_switch_type_point(
            "ST_error",
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
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        assert_eq!("ST_error", ids[0]);
    }

    #[test]
    fn unused_port() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.load_switch_type(create_switch_type_point(
            "ST_error",
            HashMap::from([(
                "LEFT".into(),
                vec![create_switch_connection("BASE".into(), "LEFT".into())],
            )]),
        ));
        let (errors, ids) = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        assert_eq!(1, ids.len());
        let infra_error = InfraError::new_unused_port("ports.2", "RIGHT".into());
        assert_eq!(to_value(infra_error).unwrap(), errors[0]);
        assert_eq!("ST_error", ids[0]);
    }
}
