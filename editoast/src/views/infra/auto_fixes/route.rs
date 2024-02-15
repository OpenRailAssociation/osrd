use super::{new_ref_fix_delete_pair, Fix};
use crate::schema::{
    InfraError, InfraErrorType, OSRDIdentified as _, OSRDObject as _, ObjectRef, ObjectType, Route,
};
use std::collections::HashMap;
use tracing::debug;

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
