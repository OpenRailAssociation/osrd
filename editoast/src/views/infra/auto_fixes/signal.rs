use std::collections::HashMap;

use tracing::debug;

use super::new_ref_fix_delete_pair;
use super::Fix;
use crate::schema::InfraError;
use crate::schema::InfraErrorType;
use crate::schema::SignalCache;
use editoast_schemas::primitives::OSRDObject as _;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

pub fn fix_signal(
    signal: &SignalCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::OutOfRange { .. } => Some(new_ref_fix_delete_pair(signal)),
            InfraErrorType::InvalidReference { reference }
                if reference.obj_type == ObjectType::TrackSection =>
            {
                Some(new_ref_fix_delete_pair(signal))
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
