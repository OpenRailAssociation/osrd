use std::collections::{HashMap, HashSet};

use diesel::sql_types::{Array, Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use crate::infra_cache::InfraCache;
use crate::schema::InfraError;
use diesel::result::Error as DieselError;
use serde_json::to_value;

pub fn insert_errors(
    conn: &PgConnection,
    infra_id: i32,
    infra_cache: &InfraCache,
) -> Result<(), DieselError> {
    let infra_errors = generate_errors(infra_cache);

    let mut switch_type_ids = vec![];
    let mut errors = vec![];

    for error in infra_errors {
        switch_type_ids.push(error.get_id().clone());
        errors.push(to_value(error).unwrap());
    }

    let count = sql_query(include_str!("sql/switch_types_insert_errors.sql"))
        .bind::<Integer, _>(infra_id)
        .bind::<Array<Text>, _>(&switch_type_ids)
        .bind::<Array<Json>, _>(&errors)
        .execute(conn)?;
    assert_eq!(count, switch_type_ids.len());

    Ok(())
}

pub fn generate_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    let mut errors = vec![];

    for (switch_type_id, switch_type) in infra_cache.switch_types().iter() {
        let switch_type = switch_type.unwrap_switch_type();
        let mut used_port = HashSet::new();
        let mut duplicate_port_connection = HashMap::new();

        for (group_name, group) in switch_type.groups.iter() {
            for (pos, connection) in group.iter().enumerate() {
                for dir in [&connection.src, &connection.dst] {
                    if !switch_type.ports.contains(dir) {
                        let infra_error = InfraError::new_unknown_port_name(
                            switch_type_id.clone(),
                            format!("groups.{}.{}", group_name, pos),
                            dir.clone(),
                        );
                        errors.push(infra_error);
                    }
                    used_port.insert(dir);
                }
            }

            if let Some(duplicate_group) = duplicate_port_connection.get(group) {
                let infra_error = InfraError::new_duplicated_group(
                    switch_type_id.clone(),
                    format!("groups.{}", group_name),
                    format!("groups.{}", duplicate_group),
                );
                errors.push(infra_error);
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
            let infra_error = InfraError::new_unused_port(
                switch_type_id.clone(),
                format!("ports.{}", pos),
                port.into(),
            );
            errors.push(infra_error);
        }
    }

    errors
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
        infra_cache.add(create_switch_type_cache(
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
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_unknown_port_name("ST_error", "groups.LEFT.0", "WRONG".into());
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn duplicated_group() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_switch_type_cache(
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
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
    }

    #[test]
    fn unused_port() {
        let mut infra_cache = create_small_infra_cache();
        infra_cache.add(create_switch_type_cache(
            "ST_error",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([(
                "LEFT".into(),
                vec![create_switch_connection("BASE".into(), "LEFT".into())],
            )]),
        ));
        let errors = generate_errors(&infra_cache);
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_unused_port("ST_error", "ports.2", "RIGHT".into());
        assert_eq!(infra_error, errors[0]);
    }
}
