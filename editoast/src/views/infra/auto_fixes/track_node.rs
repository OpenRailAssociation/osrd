use std::collections::HashMap;

use tracing::debug;

use super::new_ref_fix_delete_pair;
use super::Fix;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorType;
use crate::infra_cache::object_cache::TrackNodeCache;
use editoast_schemas::primitives::OSRDObject as _;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

pub fn fix_track_node(
    track_node: &TrackNodeCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::InvalidTrackNodePorts => Some(new_ref_fix_delete_pair(track_node)),
            InfraErrorType::InvalidReference { reference }
                if reference.obj_type == ObjectType::TrackSection =>
            {
                Some(new_ref_fix_delete_pair(track_node))
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}
