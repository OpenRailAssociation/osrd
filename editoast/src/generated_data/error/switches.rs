use crate::infra_cache::{Graph, InfraCache, ObjectCache};
use crate::schema::{InfraError, ObjectRef, ObjectType, TrackEndpoint};
use std::collections::{HashMap, HashSet};

use super::ObjectErrorGenerator;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<Context>; 4] = [
    ObjectErrorGenerator::new(1, check_invalid_ref_ports),
    ObjectErrorGenerator::new(1, check_invalid_ref_switch_type),
    ObjectErrorGenerator::new(2, check_match_ports_type),
    ObjectErrorGenerator::new_ctx(3, check_overlapping),
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
    use crate::generated_data::error::switches::Context;
    use crate::infra_cache::tests::{
        create_small_infra_cache, create_switch_cache_point, create_track_endpoint,
    };
    use crate::schema::{Endpoint, ObjectRef, ObjectType};

    use super::check_invalid_ref_ports;
    use super::check_invalid_ref_switch_type;
    use super::check_match_ports_type;
    use super::check_overlapping;
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
        let errors =
            check_invalid_ref_ports(&switch.clone().into(), &infra_cache, &Default::default());
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
            ("BASE", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        );
        infra_cache.add(switch.clone());

        let switch_cache = &mut context.endpoint_to_switch;
        for port in switch.ports.values() {
            switch_cache.insert(port.clone(), switch.obj_id.clone());
        }
        let (errors, _) =
            check_overlapping(&switch.into(), &infra_cache, &Default::default(), context);
        assert_eq!(1, errors.len());
    }
}
