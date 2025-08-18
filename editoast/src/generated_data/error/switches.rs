use std::collections::HashMap;
use std::collections::HashSet;

use super::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use schemas::infra::TrackEndpoint;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::ObjectRef;
use schemas::primitives::ObjectType;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<Context>; 5] = [
    ObjectErrorGenerator::new(1, check_invalid_ref_ports),
    ObjectErrorGenerator::new(1, check_invalid_ref_switch_type),
    ObjectErrorGenerator::new(2, check_match_ports_type),
    ObjectErrorGenerator::new(3, check_endpoints_unicity),
    ObjectErrorGenerator::new_ctx(4, check_overlapping),
];

/// Context for the switch error generators
#[derive(Debug, Default)]
pub struct Context {
    /// Track endpoint to their switch
    endpoint_to_switch: HashMap<TrackEndpoint, String>,
}

/// Check that ports (track endpoints) exists
fn check_invalid_ref_ports(
    switch: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let switch = switch.unwrap_switch();
    let mut infra_errors = vec![];
    for (port_name, port) in switch.ports.iter() {
        if !infra_cache
            .track_sections()
            .contains_key::<String>(&port.track)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, &port.track);
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
    switch: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let switch = switch.unwrap_switch();
    let switch_type = switch.switch_type.clone();
    if !infra_cache
        .switch_types()
        .contains_key(&switch_type.clone())
    {
        let obj_ref = ObjectRef::new(ObjectType::SwitchType, switch_type.clone());
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
pub fn check_match_ports_type(
    switch: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let switch = switch.unwrap_switch();
    let match_ports: HashSet<&String> = switch.ports.keys().collect();
    let switch_type = infra_cache
        .switch_types()
        .get(&switch.switch_type)
        .unwrap()
        .unwrap_switch_type();
    let original_ports: HashSet<&String> = switch_type.ports.iter().map(|e| &e.0).collect();
    if match_ports != original_ports {
        vec![InfraError::new_invalid_switch_ports(switch, "ports")]
    } else {
        vec![]
    }
}

/// Check if node track endpoints are unique
pub fn check_endpoints_unicity(switch: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let switch = switch.unwrap_switch();
    let endpoints: HashSet<_> = switch.ports.values().collect();
    if endpoints.len() != switch.ports.len() {
        vec![InfraError::new_node_endpoint_not_unique(switch.get_id())]
    } else {
        vec![]
    }
}

/// Check if the switch ports are not already used by another switch
fn check_overlapping(
    switch: &ObjectCache,
    _: &InfraCache,
    _: &Graph,
    mut context: Context,
) -> (Vec<InfraError>, Context) {
    let switch = switch.unwrap_switch();
    let switch_cache = &mut context.endpoint_to_switch;
    if let Some(port) = switch.ports.values().find(|p| switch_cache.contains_key(p)) {
        (
            vec![InfraError::new_overlapping_switches(
                switch,
                switch_cache.get(port).unwrap(),
            )],
            context,
        )
    } else {
        // Add endpoints to the context
        for port in switch.ports.values() {
            switch_cache.insert(port.clone(), switch.obj_id.clone());
        }
        (vec![], context)
    }
}

#[cfg(test)]
mod tests {
    use super::InfraError;
    use super::check_invalid_ref_ports;
    use super::check_invalid_ref_switch_type;
    use super::check_match_ports_type;
    use super::check_overlapping;
    use crate::generated_data::error::switches::Context;
    use crate::generated_data::error::switches::check_endpoints_unicity;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::tests::create_switch_cache_point;
    use crate::infra_cache::tests::create_track_endpoint;
    use schemas::infra::Endpoint;
    use schemas::primitives::OSRDIdentified;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn invalid_ref_track() {
        let mut infra_cache = create_small_infra_cache();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "E")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(&switch).unwrap();
        let errors =
            check_invalid_ref_ports(&switch.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&switch, "ports.A.track", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn invalid_ref_switch_type() {
        let mut infra_cache = create_small_infra_cache();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "non_existing_switch_type".into(),
        );
        infra_cache.add(&switch).unwrap();
        let errors = check_invalid_ref_switch_type(
            &switch.clone().into(),
            &infra_cache,
            &Default::default(),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::SwitchType, "non_existing_switch_type");
        let infra_error = InfraError::new_invalid_reference(&switch, "switch_type", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn not_unique_endpoints() {
        let mut infra_cache = create_small_infra_cache();
        // Ports A and B1 map the same endpoint
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::End, "B")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(&switch).unwrap();
        let errors =
            check_endpoints_unicity(&switch.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_node_endpoint_not_unique(switch.get_id());
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn incorrect_ports() {
        let mut infra_cache = create_small_infra_cache();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("WRONG", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(&switch).unwrap();
        let errors =
            check_match_ports_type(&switch.clone().into(), &infra_cache, &Default::default());
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_invalid_switch_ports(&switch, "ports");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_switches() {
        let mut infra_cache = create_small_infra_cache();
        let mut context = Context::default();
        let switch = create_switch_cache_point(
            "SW_error".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        );
        infra_cache.add(&switch).unwrap();

        let switch_cache = &mut context.endpoint_to_switch;
        for port in switch.ports.values() {
            switch_cache.insert(port.clone(), switch.obj_id.clone());
        }
        let (errors, _) =
            check_overlapping(&switch.into(), &infra_cache, &Default::default(), context);
        assert_eq!(1, errors.len());
    }
}
