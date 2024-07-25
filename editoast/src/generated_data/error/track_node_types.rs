use std::collections::HashMap;
use std::collections::HashSet;

use super::NoContext;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 1] =
    [ObjectErrorGenerator::new(1, check_track_node_types)];

/// Check unknown port name, duplicated group and unused port for track_node_type
pub fn check_track_node_types(track_node_type: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let track_node_type = track_node_type.unwrap_track_node_type();
    let mut used_port = HashSet::new();
    let mut duplicate_port_connection = HashMap::new();
    let mut infra_errors = vec![];
    for (group_name, group) in track_node_type.groups.iter() {
        for (pos, connection) in group.iter().enumerate() {
            for dir in [&connection.src, &connection.dst] {
                if !track_node_type.ports.contains(dir) {
                    infra_errors.push(InfraError::new_unknown_port_name(
                        track_node_type,
                        format!("groups.{group_name}.{pos}"),
                        dir,
                    ));
                }
                used_port.insert(dir);
            }
        }
        if let Some(duplicate_group) = duplicate_port_connection.get(group) {
            infra_errors.push(InfraError::new_duplicated_group(
                track_node_type,
                format!("groups.{group_name}"),
                format!("groups.{duplicate_group}"),
            ));
        } else {
            duplicate_port_connection.insert(group, group_name);
        }
    }
    for (pos, port) in track_node_type
        .ports
        .iter()
        .enumerate()
        .filter(|(_, ports)| !used_port.contains(ports))
    {
        infra_errors.push(InfraError::new_unused_port(
            track_node_type,
            format!("ports.{pos}"),
            port,
        ));
    }
    infra_errors
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::check_track_node_types;
    use super::InfraError;
    use crate::infra_cache;
    use crate::infra_cache::tests::create_track_node_connection;
    use crate::infra_cache::tests::create_track_node_type_cache;
    use crate::infra_cache::Graph;

    #[test]
    fn unknown_port_name() {
        let track_node_type = create_track_node_type_cache(
            "ST_error",
            vec!["A".into(), "B1".into(), "B2".into()],
            HashMap::from([
                ("A_B1".into(), vec![create_track_node_connection("WRONG", "B1")]),
                ("A_B2".into(), vec![create_track_node_connection("A", "B2")]),
            ]),
        )
        .into();
        let errors = check_track_node_types(
            &track_node_type,
            &infra_cache::tests::create_small_infra_cache(),
            &Graph::load(&infra_cache::tests::create_small_infra_cache()),
        );
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_unknown_port_name(&track_node_type, "groups.A_B1.0", "WRONG");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn duplicated_group() {
        let track_node_type = create_track_node_type_cache(
            "ST_error",
            vec!["A".into(), "B1".into(), "B2".into()],
            HashMap::from([
                ("A_B1".into(), vec![create_track_node_connection("A", "B1")]),
                ("ERROR".into(), vec![create_track_node_connection("A", "B1")]),
                ("A_B2".into(), vec![create_track_node_connection("A", "B2")]),
            ]),
        )
        .into();
        let errors = check_track_node_types(
            &track_node_type,
            &infra_cache::tests::create_small_infra_cache(),
            &Graph::load(&infra_cache::tests::create_small_infra_cache()),
        );
        assert_eq!(1, errors.len());
    }

    #[test]
    fn unused_port() {
        let track_node_type = create_track_node_type_cache(
            "ST_error",
            vec!["A".into(), "B1".into(), "B2".into()],
            HashMap::from([("A_B1".into(), vec![create_track_node_connection("A", "B1")])]),
        )
        .into();
        let infra_cache = infra_cache::tests::create_small_infra_cache();
        let errors = check_track_node_types(&track_node_type, &infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_unused_port(&track_node_type, "ports.2", "B2");
        assert_eq!(infra_error, errors[0]);
    }
}
