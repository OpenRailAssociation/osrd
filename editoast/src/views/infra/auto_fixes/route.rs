use std::collections::HashMap;

use tracing::debug;

use super::Fix;
use super::new_ref_fix_delete_pair;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorType;
use schemas::infra::Route;
use schemas::primitives::OSRDIdentified as _;
use schemas::primitives::OSRDObject as _;
use schemas::primitives::ObjectRef;
use schemas::primitives::ObjectType;

pub fn fix_route(
    route: &Route,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::InvalidReference { reference }
                if matches!(
                    reference.obj_type,
                    ObjectType::BufferStop | ObjectType::Detector
                ) =>
            {
                if reference.obj_id.eq(route.entry_point.get_id())
                    || reference.obj_id.eq(route.exit_point.get_id())
                {
                    Some(new_ref_fix_delete_pair(route))
                } else {
                    None
                }
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
