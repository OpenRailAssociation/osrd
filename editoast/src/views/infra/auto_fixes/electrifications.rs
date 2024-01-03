use super::{new_ref_fix_delete_pair, Fix};
use crate::schema::{Electrification, InfraError, InfraErrorType, OSRDObject as _, ObjectRef};
use log::debug;
use std::collections::HashMap;

pub fn fix_electrification(
    electrification: &Electrification,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::EmptyObject => Some(new_ref_fix_delete_pair(electrification)),
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
