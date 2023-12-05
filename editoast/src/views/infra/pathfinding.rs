use std::collections::HashMap;

use actix_web::dev::HttpServiceFactory;
use actix_web::post;
use actix_web::web::{Data, Json, Path, Query};
use chashmap::CHashMap;
use derivative::Derivative;
use pathfinding::prelude::yen;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::error::Result;
use crate::infra_cache::{Graph, InfraCache};
use crate::models::Infra;
use crate::schema::utils::Identifier;
use crate::schema::{Direction, DirectionalTrackRange, Endpoint, ObjectType, TrackEndpoint};
use crate::views::infra::InfraApiError;
use crate::DbPool;
use editoast_derive::EditoastError;

/// Return `/infra/<infra_id>/pathfinding` routes
pub fn routes() -> impl HttpServiceFactory {
    pathfinding_view
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

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct PathfindingTrackLocationDirInput {
    track: Identifier,
    position: f64,
    direction: Direction,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct PathfindingTrackLocationInput {
    track: Identifier,
    position: f64,
}

#[derive(Debug, Clone, Deserialize)]
struct PathfindingInput {
    starting: PathfindingTrackLocationDirInput,
    ending: PathfindingTrackLocationInput,
}

#[derive(Debug, Default, Clone, Serialize)]
struct PathfindingOutput {
    track_ranges: Vec<DirectionalTrackRange>,
    detectors: Vec<Identifier>,
    switches_directions: HashMap<Identifier, Identifier>,
}

#[derive(Debug, Clone, Deserialize)]
struct QueryParam {
    number: Option<u8>,
}

/// This endpoint search path between starting and ending track locations
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
    starting_step: bool,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    previous: Option<Box<PathfindingStep>>,
    total_length: u64,
}

impl PathfindingStep {
    fn new_init(track: String, position: f64, direction: Direction) -> Self {
        Self {
            track,
            position,
            direction,
            switch_direction: None,
            found: false,
            starting_step: true,
            previous: None,
            total_length: 0,
        }
    }

    fn new(
        track: String,
        position: f64,
        direction: Direction,
        switch_direction: Option<(Identifier, Identifier)>,
        found: bool,
        previous: PathfindingStep,
        length: u64,
    ) -> Self {
        let total_length = previous.total_length + length;
        Self {
            track,
            position,
            direction,
            switch_direction,
            found,
            starting_step: false,
            previous: Some(Box::new(previous)),
            total_length,
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
    let mut best_distance = u64::MAX;
    let successors = |step: &PathfindingStep| {
        // We initially don’t know in which direction start searching the path
        // So the first step as two successors, at the same track-position, but in opposite directions
        if step.starting_step {
            return vec![
                (
                    PathfindingStep::new(
                        step.track.clone(),
                        step.position,
                        Direction::StartToStop,
                        None,
                        false,
                        step.clone(),
                        0,
                    ),
                    0,
                ),
                (
                    PathfindingStep::new(
                        step.track.clone(),
                        step.position,
                        Direction::StopToStart,
                        None,
                        false,
                        step.clone(),
                        0,
                    ),
                    0,
                ),
            ];
        }
        // The successor is our on ending track
        if step.track == input.ending.track.0 {
            // If we aren't in the good direction to reach the ending position, it's a dead end
            if step.direction == Direction::StartToStop && step.position > input.ending.position
                || step.direction == Direction::StopToStart && step.position < input.ending.position
            {
                return vec![];
            }
            let cost = into_cost((step.position - input.ending.position).abs());
            best_distance = best_distance.min(step.total_length + cost);
            return vec![(
                PathfindingStep::new(
                    step.track.clone(),
                    input.ending.position,
                    step.direction,
                    None,
                    true,
                    step.clone(),
                    cost,
                ),
                cost,
            )];
        }

        // Compute the cost to go to the end of the track
        let track_length = get_length(&step.track);
        let cost = if step.direction == Direction::StartToStop {
            into_cost(track_length - step.position)
        } else {
            into_cost(step.position)
        };
        // We search for k-shortest path. However, we want to prune routes that are too long compared to the shortest
        // We can’t do best_distance * 3, as initially it is u64::MAX
        if (step.total_length + cost) / 3 > best_distance {
            return vec![];
        }

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
                        switch.map(|s| (s.obj_id.clone().into(), neighbour_group.clone())),
                        false,
                        step.clone(),
                        cost,
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
    // We ignore the first element of path, as it is a virtual step to handle going in both directions
    (1..(path.len() - 2)).for_each(|i| {
        let end = if path[i].direction == Direction::StartToStop {
            infra_cache.track_sections()[&path[i].track]
                .unwrap_track_section()
                .length
        } else {
            0.0
        };
        track_ranges.push(DirectionalTrackRange::new(
            path[i].track.clone(),
            path[i].position.min(end),
            path[i].position.max(end),
            path[i].direction,
        ));
    });
    let last = &path[path.len() - 1];
    let before_last = &path[path.len() - 2];
    track_ranges.push(DirectionalTrackRange::new(
        last.track.clone(),
        last.position.min(before_last.position),
        last.position.max(before_last.position),
        last.direction,
    ));
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
    use crate::schema::utils::Identifier;
    use crate::schema::{Direction, DirectionalTrackRange};
    use crate::views::infra::pathfinding::{
        PathfindingInput, PathfindingTrackLocationDirInput, PathfindingTrackLocationInput,
    };

    fn expected_path() -> Vec<DirectionalTrackRange> {
        vec![
            DirectionalTrackRange::new("A", 30., 500., Direction::StartToStop),
            DirectionalTrackRange::new("B", 0., 500., Direction::StartToStop),
            DirectionalTrackRange::new("C", 0., 470., Direction::StartToStop),
        ]
    }
    fn expected_switches() -> HashMap<Identifier, Identifier> {
        HashMap::from([
            ("link".into(), "LINK".into()),
            ("switch".into(), "A_B1".into()),
        ])
    }

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
        assert_eq!(path.track_ranges, expected_path());
        assert_eq!(path.detectors, vec!["D1".into()]);
        assert_eq!(path.switches_directions, expected_switches());
    }

    #[test]
    fn test_compute_path_opposite_direction() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let input = PathfindingInput {
            starting: PathfindingTrackLocationDirInput {
                track: "A".into(),
                position: 30.0,
                direction: Direction::StopToStart,
            },
            ending: PathfindingTrackLocationInput {
                track: "C".into(),
                position: 470.0,
            },
        };
        let mut paths = compute_path(&input, &infra_cache, &graph, 1);

        assert_eq!(paths.len(), 1);
        let path = paths.pop().unwrap();
        assert_eq!(path.track_ranges, expected_path());
        assert_eq!(path.detectors, vec!["D1".into()]);
        assert_eq!(path.switches_directions, expected_switches());
    }
}
