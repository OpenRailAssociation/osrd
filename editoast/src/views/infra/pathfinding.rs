use std::collections::HashMap;

use actix_web::post;
use actix_web::web::{Data, Json, Path, Query};
use chashmap::CHashMap;
use derivative::Derivative;
use pathfinding::prelude::yen;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;
use crate::infra_cache::{Graph, InfraCache};
use crate::models::Infra;
use crate::schema::utils::Identifier;
use crate::schema::{Direction, DirectionalTrackRange, Endpoint, ObjectType, TrackEndpoint};
use crate::views::infra::InfraApiError;
use crate::{routes, DbPool, schemas};
use editoast_derive::EditoastError;

routes! {
    pathfinding_view
}

schemas! {
    PathfindingInput,
    PathfindingTrackLocationDirInput,
    PathfindingTrackLocationInput,
    PathfindingOutput,
}

const DEFAULT_NUMBER_OF_PATHS: u8 = 5;
const MAX_NUMBER_OF_PATHS: u8 = 5;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:pathfinding")]
enum PathfindingViewErrors {
    #[error("Starting track location was not found")]
    StartingTrackLocationNotFound,
    #[error("Ending track location was not found")]
    EndingTrackLocationNotFound,
    #[error(
        "The pathfinding cannot return {0} paths (expected: [1-{}])",
        MAX_NUMBER_OF_PATHS
    )]
    InvalidNumberOfPaths(u8),
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct PathfindingTrackLocationDirInput {
    track: Identifier,
    position: f64,
    direction: Direction,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct PathfindingTrackLocationInput {
    track: Identifier,
    position: f64,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
struct PathfindingInput {
    starting: PathfindingTrackLocationDirInput,
    ending: PathfindingTrackLocationInput,
}

#[derive(Debug, Default, Clone, Serialize, ToSchema)]
struct PathfindingOutput {
    track_ranges: Vec<DirectionalTrackRange>,
    detectors: Vec<Identifier>,
    switches_directions: HashMap<Identifier, Identifier>,
}

#[derive(Debug, Clone, Deserialize)]
struct QueryParam {
    number: Option<u8>,
}

/// Compute paths given starting and ending track location. Return shortest paths.
#[utoipa::path(
    params(super::InfraId),
    responses(
        (
            status = 200, 
            body = Vec<PathfindingOutput>, 
            description = "Paths, containing track ranges, detectors and switches with their directions. If no path is found, an empty list is returned."
        )
    ),
)]
#[post("/pathfinding")]
async fn pathfinding_view(
    infra: Path<i64>,
    params: Query<QueryParam>,
    input: Json<PathfindingInput>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<PathfindingOutput>>> {
    // Parse and check input
    let infra_id = infra.into_inner();
    let number = params.number.unwrap_or(DEFAULT_NUMBER_OF_PATHS);
    if !(1..=MAX_NUMBER_OF_PATHS).contains(&number) {
        return Err(PathfindingViewErrors::InvalidNumberOfPaths(number).into());
    }

    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_for_update(&mut conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;

    // Check that the starting and ending track locations are valid
    if !infra_cache
        .track_sections()
        .contains_key(&input.starting.track.0)
    {
        return Err(PathfindingViewErrors::StartingTrackLocationNotFound.into());
    } else if !infra_cache
        .track_sections()
        .contains_key(&input.ending.track.0)
    {
        return Err(PathfindingViewErrors::EndingTrackLocationNotFound.into());
    }
    // Generating the graph
    let graph = Graph::load(&infra_cache);
    Ok(Json(compute_path(&input, &infra_cache, &graph, number)))
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, Eq, PartialEq)]
struct PathfindingStep {
    track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    position: f64,
    direction: Direction,
    switch_direction: Option<(Identifier, Identifier)>,
    found: bool,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    previous: Option<Box<PathfindingStep>>,
}

impl PathfindingStep {
    fn new_init(track: String, position: f64, direction: Direction) -> Self {
        Self {
            track,
            position,
            direction,
            switch_direction: None,
            found: false,
            previous: None,
        }
    }

    fn new(
        track: String,
        position: f64,
        direction: Direction,
        switch_direction: Option<(Identifier, Identifier)>,
        found: bool,
        previous: PathfindingStep,
    ) -> Self {
        Self {
            track,
            position,
            direction,
            switch_direction,
            found,
            previous: Some(Box::new(previous)),
        }
    }

    /// Check if the step or a previous step is using the given switch
    fn is_using_switch(&self, switch_id: &String) -> bool {
        if let Some((switch, _)) = &self.switch_direction {
            if switch.0 == *switch_id {
                return true;
            }
        }

        self.previous
            .as_ref()
            .map_or(false, |p| p.is_using_switch(switch_id))
    }
}

/// Compute the path between starting and ending locations using Dijkstra (return at most `number_result` paths)
fn compute_path(
    input: &PathfindingInput,
    infra_cache: &InfraCache,
    graph: &Graph,
    k: u8,
) -> Vec<PathfindingOutput> {
    let start = &input.starting;
    let start = PathfindingStep::new_init(start.track.0.clone(), start.position, start.direction);

    let track_sections = infra_cache.track_sections();
    // Transform a length (in m) into a cost (in mm). This provide the Ord implementation for our cost using u64.
    let into_cost = |length: f64| (length * 100.).round() as u64;
    let get_length = |track: &String| track_sections[track].unwrap_track_section().length;
    let success = |step: &PathfindingStep| step.found;
    let successors = |step: &PathfindingStep| {
        // The successor is our on ending track
        if step.track == input.ending.track.0 {
            // If we aren't in the good direction to reach the ending position, it's a dead end
            if step.direction == Direction::StartToStop && step.position > input.ending.position
                || step.direction == Direction::StopToStart && step.position < input.ending.position
            {
                return vec![];
            }
            return vec![(
                PathfindingStep::new(
                    step.track.clone(),
                    input.ending.position,
                    step.direction,
                    None,
                    true,
                    step.clone(),
                ),
                into_cost((step.position - input.ending.position).abs()),
            )];
        }

        // Compute the cost to go to the end of the track
        let track_length = get_length(&step.track);
        let cost = if step.direction == Direction::StartToStop {
            into_cost(track_length - step.position)
        } else {
            into_cost(step.position)
        };

        // Find neighbours
        let mut successors = vec![];
        let endpoint = TrackEndpoint::from_track_and_direction(&step.track, step.direction);
        let switch = graph.get_switch(&endpoint);

        // Check switch not already used
        if let Some(switch) = switch {
            let switch_id = &switch.obj_id;
            if step.is_using_switch(switch_id) {
                return vec![];
            }
        }

        for neighbour_group in graph.get_neighbour_groups(&endpoint) {
            let neighbour = graph.get_neighbour(&endpoint, neighbour_group).unwrap();
            if let Some(neighbour_track) = infra_cache.track_sections().get(&neighbour.track.0) {
                let neighbour_track = neighbour_track.unwrap_track_section();
                let (pos, dir) = if neighbour.endpoint == Endpoint::Begin {
                    (0.0, Direction::StartToStop)
                } else {
                    (neighbour_track.length, Direction::StopToStart)
                };
                successors.push((
                    PathfindingStep::new(
                        neighbour_track.obj_id.clone(),
                        pos,
                        dir,
                        switch.map(|s| (s.obj_id.clone().into(), neighbour_group.unwrap().clone())),
                        false,
                        step.clone(),
                    ),
                    cost,
                ));
            }
        }
        successors
    };

    let results = yen(&start, successors, success, k.into());

    // Build the output
    results
        .iter()
        .map(|(result, _)| build_path_output(result, infra_cache))
        .collect()
}

fn build_path_output(path: &Vec<PathfindingStep>, infra_cache: &InfraCache) -> PathfindingOutput {
    // Fill track ranges
    let mut track_ranges = Vec::new();
    (0..(path.len() - 2)).for_each(|i| {
        let end = if path[i].direction == Direction::StartToStop {
            infra_cache.track_sections()[&path[i].track]
                .unwrap_track_section()
                .length
        } else {
            0.0
        };
        track_ranges.push(DirectionalTrackRange {
            track: path[i].track.clone().into(),
            begin: path[i].position.min(end),
            end: path[i].position.max(end),
            direction: path[i].direction,
        });
    });
    let last = &path[path.len() - 1];
    let before_last = &path[path.len() - 2];
    track_ranges.push(DirectionalTrackRange {
        track: last.track.clone().into(),
        begin: last.position.min(before_last.position),
        end: last.position.max(before_last.position),
        direction: last.direction,
    });

    // Fill switches directions
    let switches_directions = path
        .iter()
        .filter_map(|step| step.switch_direction.clone())
        .collect();

    // Search for detectors on the path
    let mut detectors = Vec::new();
    for track_range in track_ranges.iter() {
        detectors.extend(
            infra_cache
                .get_track_refs_type(&track_range.track, ObjectType::Detector)
                .iter()
                .filter_map(|detector| {
                    let detector = infra_cache.detectors()[&detector.obj_id].unwrap_detector();
                    // Keep detectors that are contained in the track range
                    if (track_range.begin..=track_range.end).contains(&detector.position) {
                        Some(detector.obj_id.clone().into())
                    } else {
                        None
                    }
                }),
        )
    }

    PathfindingOutput {
        track_ranges,
        detectors,
        switches_directions,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::compute_path;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::Graph;
    use crate::schema::{Direction, DirectionalTrackRange};
    use crate::views::infra::pathfinding::{
        PathfindingInput, PathfindingTrackLocationDirInput, PathfindingTrackLocationInput,
    };

    #[test]
    fn test_compute_path() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let input = PathfindingInput {
            starting: PathfindingTrackLocationDirInput {
                track: "A".into(),
                position: 30.0,
                direction: Direction::StartToStop,
            },
            ending: PathfindingTrackLocationInput {
                track: "C".into(),
                position: 470.0,
            },
        };
        let mut paths = compute_path(&input, &infra_cache, &graph, 1);

        assert_eq!(paths.len(), 1);
        let path = paths.pop().unwrap();
        assert_eq!(
            path.track_ranges,
            vec![
                DirectionalTrackRange {
                    track: "A".into(),
                    begin: 30.,
                    end: 500.,
                    direction: Direction::StartToStop
                },
                DirectionalTrackRange {
                    track: "B".into(),
                    begin: 0.,
                    end: 500.,
                    direction: Direction::StartToStop
                },
                DirectionalTrackRange {
                    track: "C".into(),
                    begin: 0.,
                    end: 470.,
                    direction: Direction::StartToStop
                }
            ]
        );
        assert_eq!(path.detectors, vec!["D1".into()]);
        assert_eq!(
            path.switches_directions,
            HashMap::from([("switch".into(), "LEFT".into())])
        );
    }
}
