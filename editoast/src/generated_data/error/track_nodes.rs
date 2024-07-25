use std::collections::HashMap;
use std::collections::HashSet;

use super::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<Context>; 5] = [
    ObjectErrorGenerator::new(1, check_invalid_ref_ports),
    ObjectErrorGenerator::new(1, check_invalid_ref_track_node_type),
    ObjectErrorGenerator::new(2, check_match_ports_type),
    ObjectErrorGenerator::new(3, check_endpoints_unicity),
    ObjectErrorGenerator::new_ctx(4, check_overlapping),
];

/// Context for the track_node error generators
#[derive(Debug, Default)]
pub struct Context {
    /// Track endpoint to their track_node
    endpoint_to_track_node: HashMap<TrackEndpoint, String>,
}

/// Check that ports (track endpoints) exists
fn check_invalid_ref_ports(
    track_node: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let track_node = track_node.unwrap_track_node();
    let mut infra_errors = vec![];
    for (port_name, port) in track_node.ports.iter() {
        if !infra_cache
            .track_sections()
            .contains_key::<String>(&port.track)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, &port.track);
            infra_errors.push(InfraError::new_invalid_reference(
                track_node,
                format!("ports.{port_name}.track"),
                obj_ref,
            ));
        }
    }
    infra_errors
}

/// Retrieve invalid track_node type refs for track_nodes
pub fn check_invalid_ref_track_node_type(
    track_node: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let track_node = track_node.unwrap_track_node();
    let track_node_type = track_node.track_node_type.clone();
    if !infra_cache
        .track_node_types()
        .contains_key(&track_node_type.clone())
    {
        let obj_ref = ObjectRef::new(ObjectType::TrackNodeType, track_node_type.clone());
        vec![InfraError::new_invalid_reference(
            track_node,
            "track_node_type",
            obj_ref,
        )]
    } else {
        vec![]
    }
}

/// Check if track_node ports match track_node type ports
pub fn check_match_ports_type(
    track_node: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let track_node = track_node.unwrap_track_node();
    let match_ports: HashSet<&String> = track_node.ports.keys().collect();
    let track_node_type = infra_cache
        .track_node_types()
        .get(&track_node.track_node_type)
        .unwrap()
        .unwrap_track_node_type();
    let original_ports: HashSet<&String> = track_node_type.ports.iter().map(|e| &e.0).collect();
    if match_ports != original_ports {
        vec![InfraError::new_invalid_track_node_ports(track_node, "ports")]
    } else {
        vec![]
    }
}

/// Check if node track endpoints are unique
pub fn check_endpoints_unicity(track_node: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let track_node = track_node.unwrap_track_node();
    let endpoints: HashSet<_> = track_node.ports.values().collect();
    if endpoints.len() != track_node.ports.len() {
        vec![InfraError::new_node_endpoint_not_unique(track_node.get_id())]
    } else {
        vec![]
    }
}

/// Check if the track_node ports are not already used by another track_node
fn check_overlapping(
    track_node: &ObjectCache,
    _: &InfraCache,
    _: &Graph,
    mut context: Context,
) -> (Vec<InfraError>, Context) {
    let track_node = track_node.unwrap_track_node();
    let track_node_cache = &mut context.endpoint_to_track_node;
    if let Some(port) = track_node.ports.values().find(|p| track_node_cache.contains_key(p)) {
        (
            vec![InfraError::new_overlapping_track_nodes(
                track_node,
                track_node_cache.get(port).unwrap(),
            )],
            context,
        )
    } else {
        // Add endpoints to the context
        for port in track_node.ports.values() {
            track_node_cache.insert(port.clone(), track_node.obj_id.clone());
        }
        (vec![], context)
    }
}

#[cfg(test)]
mod tests {
    use super::check_invalid_ref_ports;
    use super::check_invalid_ref_track_node_type;
    use super::check_match_ports_type;
    use super::check_overlapping;
    use super::InfraError;
    use crate::generated_data::error::track_nodes::check_endpoints_unicity;
    use crate::generated_data::error::track_nodes::Context;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::tests::create_track_node_cache_point;
    use crate::infra_cache::tests::create_track_endpoint;
    use editoast_schemas::infra::Endpoint;
    use editoast_schemas::primitives::OSRDIdentified;
    use editoast_schemas::primitives::ObjectRef;
    use editoast_schemas::primitives::ObjectType;

    #[test]
    fn invalid_ref_track() {
        let mut infra_cache = create_small_infra_cache();
        let track_node = create_track_node_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "E")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(track_node.clone()).unwrap();
        let errors =
            check_invalid_ref_ports(&track_node.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&track_node, "ports.A.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref_track_node_type() {
        let mut infra_cache = create_small_infra_cache();
        let track_node = create_track_node_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "non_existing_track_node_type".into(),
        );
        infra_cache.add(track_node.clone()).unwrap();
        let errors = check_invalid_ref_track_node_type(
            &track_node.clone().into(),
            &infra_cache,
            &Default::default(),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackNodeType, "non_existing_track_node_type");
        let infra_error = InfraError::new_invalid_reference(&track_node, "track_node_type", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn not_unique_endpoints() {
        let mut infra_cache = create_small_infra_cache();
        // Ports A and B1 map the same endpoint
        let track_node = create_track_node_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::End, "B")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(track_node.clone()).unwrap();
        let errors =
            check_endpoints_unicity(&track_node.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_node_endpoint_not_unique(track_node.get_id());
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn incorrect_ports() {
        let mut infra_cache = create_small_infra_cache();
        let track_node = create_track_node_cache_point(
            "SW_error".into(),
            ("WRONG", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(track_node.clone()).unwrap();
        let errors =
            check_match_ports_type(&track_node.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_track_node_ports(&track_node, "ports");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_track_nodes() {
        let mut infra_cache = create_small_infra_cache();
        let mut context = Context::default();
        let track_node = create_track_node_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        );
        infra_cache.add(track_node.clone()).unwrap();

        let track_node_cache = &mut context.endpoint_to_track_node;
        for port in track_node.ports.values() {
            track_node_cache.insert(port.clone(), track_node.obj_id.clone());
        }
        let (errors, _) =
            check_overlapping(&track_node.into(), &infra_cache, &Default::default(), context);
        assert_eq!(1, errors.len());
    }
}
