use editoast_schemas::primitives::OSRDObject as _;
use editoast_schemas::primitives::ObjectRef;
use std::collections::HashMap;

use tracing::debug;

use super::new_ref_fix_delete_pair;
use super::Fix;
use crate::infra_cache::object_cache::OperationalPointCache;
use crate::schema::InfraError;
use crate::schema::InfraErrorType;

pub fn fix_operational_point(
    operational_point: &OperationalPointCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::EmptyObject => Some(new_ref_fix_delete_pair(operational_point)),
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
