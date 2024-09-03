use std::collections::HashMap;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use derivative::Derivative;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use pathfinding::prelude::yen;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::AppState;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::DirectionalTrackRange;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::primitives::ObjectType;

crate::routes! {
    "/pathfinding" => pathfinding_view,
}

editoast_common::schemas! {
    PathfindingTrackLocationInput,
    PathfindingInput,
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
    #[error("The pathfinding cannot return {path_number} paths (expected: [1-{max_number}])")]
    InvalidNumberOfPaths { path_number: u8, max_number: u8 },
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct PathfindingTrackLocationInput {
    #[schema(inline)]
    track: Identifier,
    position: f64,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
struct PathfindingInput {
    starting: PathfindingTrackLocationInput,
    ending: PathfindingTrackLocationInput,
}

#[derive(Debug, Default, Clone, Serialize, ToSchema)]
struct PathfindingOutput {
    track_ranges: Vec<DirectionalTrackRange>,
    #[schema(inline)]
    detectors: Vec<Identifier>,
    #[schema(inline)]
    switches_directions: HashMap<Identifier, Identifier>,
}

#[derive(Debug, Clone, IntoParams, Deserialize)]
#[into_params(parameter_in = Query)]
struct QueryParam {
    number: Option<u8>,
}

/// This endpoint search path between starting and ending track locations
#[utoipa::path(
    post, path = "",
    tag = "infra,pathfinding",
    params(InfraIdParam, QueryParam),
    request_body = PathfindingInput,
    responses(
        (status = 200, description = "A list of shortest paths between starting and ending track locations", body = Vec<PathfindingOutput>)
    )
)]
async fn pathfinding_view(
    app_state: State<AppState>,
    Extension(authorizer): AuthorizerExt,
    Path(infra): Path<InfraIdParam>,
    Query(params): Query<QueryParam>,
    Json(input): Json<PathfindingInput>,
) -> Result<Json<Vec<PathfindingOutput>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let infra_caches = app_state.infra_caches.clone();

    // Parse and check input
    let infra_id = infra.infra_id;
    let number = params.number.unwrap_or(DEFAULT_NUMBER_OF_PATHS);
    if !(1..=MAX_NUMBER_OF_PATHS).contains(&number) {
        return Err(PathfindingViewErrors::InvalidNumberOfPaths {
            path_number: number,
            max_number: MAX_NUMBER_OF_PATHS,
        }
        .into());
    }

    // TODO: lock for share
    let infra = Infra::retrieve_or_fail(&db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let infra_cache = InfraCache::get_or_load(&db_pool.get().await?, &infra_caches, &infra).await?;

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
    fn new_init(track: String, position: f64) -> Self {
        Self {
            track,
            position,
            direction: Direction::StartToStop, // Ignored for initial node
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
    let start = PathfindingStep::new_init(start.track.0.clone(), start.position);

    let track_sections = infra_cache.track_sections();
    // Transform a length (in m) into a cost (in mm). This provide the Ord implementation for our cost using u64.
    let into_cost = |length: f64| (length * 100.).round() as u64;
    let get_length = |track: &String| track_sections[track].unwrap_track_section().length;
    let success = |step: &PathfindingStep| step.found;

    let starting_track = track_sections[&input.starting.track.0].unwrap_track_section();
    let ending_track = track_sections[&input.ending.track.0].unwrap_track_section();
    let best_distance = starting_track
        .bbox_geo
        .clone()
        .union(&ending_track.bbox_geo)
        .diagonal_length();
    // We build an upper bound that is the diagonal of the bounding box covering start and end
    // During the path search, we prune any route that is twice that distance
    // We set an upper bound of at least 10 km to avoid problems on very short distances
    let mut best_distance = into_cost(best_distance.max(10_000.0));

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

fn build_path_output(path: &[PathfindingStep], infra_cache: &InfraCache) -> PathfindingOutput {
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
    use crate::views::infra::pathfinding::PathfindingInput;
    use crate::views::infra::pathfinding::PathfindingTrackLocationInput;
    use editoast_schemas::infra::Direction;
    use editoast_schemas::infra::DirectionalTrackRange;
    use editoast_schemas::primitives::Identifier;

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
            starting: PathfindingTrackLocationInput {
                track: "A".into(),
                position: 30.0,
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
            starting: PathfindingTrackLocationInput {
                track: "A".into(),
                position: 30.0,
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
