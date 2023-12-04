use super::super::pathfinding;
use super::{new_ref_fix_delete_pair, AutoFixesEditoastError, Fix};
use crate::{
    error::Result,
    infra_cache::{Graph, InfraCache},
    schema::{
        operation::Operation, utils::Identifier, InfraError, InfraErrorType, OSRDIdentified as _,
        OSRDObject as _, ObjectRef, ObjectType, Route,
    },
    views::infra::pathfinding::{
        PathfindingInput, PathfindingTrackLocationInput, MAX_NUMBER_OF_PATHS,
    },
};
use log::{debug, warn};
use std::collections::HashMap;

pub fn fix_route(
    route: &Route,
    errors: impl Iterator<Item = InfraError>,
    infra_cache: &InfraCache,
) -> HashMap<ObjectRef, Fix> {
    let mut invalid_switch_ids = vec![];
    let fixes = errors
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
            InfraErrorType::InvalidReference { reference }
                if matches!(reference.obj_type, ObjectType::Switch) =>
            {
                // first retrieve all invalid switches for given route
                invalid_switch_ids.push(reference.obj_id.to_string());
                None
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect();

    // Possible perf improvement: Fix only on second general iteration (once all
    // invalid switches, waypoints and routes are deleted)
    if !invalid_switch_ids.is_empty() {
        get_operations_fixing_route_invalid_references_to_switches(
            route.get_id(),
            &invalid_switch_ids,
            infra_cache,
        )
        .unwrap_or_else(|e| {
            warn!(
                "failed to fix invalid reference to switch for route {}: {:?}",
                route.get_id(),
                e
            );
            vec![]
        });
    }

    fixes
}

const MAX_EXTRA_SWITCHES_IN_ROUTE_AUTOFIX: usize = 5;

fn get_operations_fixing_route_invalid_references_to_switches(
    route_id: &str,
    invalid_switches_ids: &[String],
    infra_cache: &InfraCache,
) -> Result<Vec<Operation>> {
    let route = infra_cache
        .get_route(route_id)
        .map_err(|source| AutoFixesEditoastError::MissingErrorObject { source })?;

    let track_entry = infra_cache.get_track_location(&route.entry_point)?;
    let track_exit = infra_cache.get_track_location(&route.exit_point)?;

    let pf_input = PathfindingInput {
        starting: PathfindingTrackLocationInput {
            track: track_entry.track_section,
            position: track_entry.offset,
        },
        ending: PathfindingTrackLocationInput {
            track: track_exit.track_section,
            position: track_exit.offset,
        },
    };

    let graph = Graph::load(infra_cache);
    let candidate_paths =
        pathfinding::compute_path(&pf_input, infra_cache, &graph, MAX_NUMBER_OF_PATHS);

    let valid_switches: HashMap<&Identifier, &Identifier> = route
        .switches_directions
        .iter()
        .filter(|s| !invalid_switches_ids.contains(s.0))
        .collect();

    for path in candidate_paths {
        // qualificate shortest path containing all the valid switches and adding
        // less than MAX_EXTRA_SWITCHES_IN_ROUTE_AUTOFIX switches compared to original broken route
        if valid_switches.iter().all(|(key, value)| {
            path.switches_directions
                .get(key)
                .map_or(false, |v| *value == v)
        }) && path.switches_directions.len()
            < route.switches_directions.len() + MAX_EXTRA_SWITCHES_IN_ROUTE_AUTOFIX
        {
            println!("PEBtrace {:?} ==> {:?}", route, path);
            return Ok(vec![]);
        }
    }

    Ok(vec![])
}
