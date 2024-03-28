use std::collections::HashMap;

use tracing::debug;

use super::new_ref_fix_delete_pair;
use super::Fix;
use crate::schema::BufferStopCache;
use crate::schema::InfraError;
use crate::schema::InfraErrorType;
use crate::schema::OSRDObject as _;
use crate::schema::ObjectRef;
use crate::schema::ObjectType;

pub fn fix_buffer_stop(
    buffer_stop: &BufferStopCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::OddBufferStopLocation | InfraErrorType::OutOfRange { .. } => {
                Some(new_ref_fix_delete_pair(buffer_stop))
            }
            InfraErrorType::InvalidReference { reference }
                if reference.obj_type == ObjectType::TrackSection =>
            {
                Some(new_ref_fix_delete_pair(buffer_stop))
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
