use super::{new_ref_fix_delete_pair, Fix};
use crate::schema::{
    DetectorCache, InfraError, InfraErrorType, OSRDObject as _, ObjectRef, ObjectType,
};
use log::debug;
use std::collections::HashMap;

pub fn fix_detector(
    detector: &DetectorCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::OutOfRange { .. } => Some(new_ref_fix_delete_pair(detector)),
            InfraErrorType::InvalidReference { reference }
                if reference.obj_type == ObjectType::TrackSection =>
            {
                Some(new_ref_fix_delete_pair(detector))
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
