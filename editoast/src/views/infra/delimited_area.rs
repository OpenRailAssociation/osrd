use crate::AppState;
use crate::error::Result;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::models::Infra;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use authz;
use axum::Extension;
use axum::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use itertools::Either;
use itertools::Itertools;
use schemas::infra::Direction;
use schemas::infra::DirectionalTrackRange;
use schemas::infra::Endpoint;
use schemas::infra::Sign;
use schemas::infra::TrackEndpoint;
use schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::collections::HashSet;
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::ToSchema;

// Maximum distance the graph can be explored from a speed limit execution signal
// without finding any legitimate ending to the speed limit before it is considered
// there is not valid limit on the portion of the graph that is being explored.
// TODO Magic number for now. Make it configurable ?
const MAXIMUM_DISTANCE: f64 = 5000.;

#[derive(Deserialize, ToSchema)]
pub(in crate::views) struct DelimitedAreaForm {
    #[schema(inline)]
    entries: Vec<DirectedLocation>,
    #[schema(inline)]
    exits: Vec<DirectedLocation>,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub(in crate::views) struct DelimitedAreaResponse {
    track_ranges: Vec<DirectionalTrackRange>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
struct DirectedLocation {
    #[schema(inline)]
    track: Identifier,
    position: f64,
    direction: Direction,
}

#[derive(Debug, Error, Serialize, Deserialize, EditoastError)]
#[editoast_error(base_id = "delimited_area")]
enum DelimitedAreaError {
    #[error("Some locations were invalid")]
    #[editoast_error(status = 400)]
    InvalidLocations {
        invalid_locations: Vec<(DirectedLocation, InputError)>,
    },
}

#[derive(Debug, Error, Serialize, Deserialize, ToSchema)]
enum InputError {
    #[error("Track '{0}' does not exist")]
    TrackDoesNotExist(String),
    #[error("Invalid input position '{position}' on track '{track}' of length '{track_length}'")]
    LocationOutOfBounds {
        track: String,
        position: f64,
        track_length: f64,
    },
}

#[derive(Debug, Error, Serialize, Deserialize)]
enum TrackRangeConstructionError {
    #[error("Track identifiers do not match")]
    TrackIdentifierMismatch,
    #[error("The input directions or locations on track do not allow to build a valid track range")]
    InvalidRelativeLocations,
    #[error("The location is not on track")]
    LocationNotOnTrack,
}

impl From<Sign> for DirectedLocation {
    fn from(value: Sign) -> Self {
        let Sign {
            track,
            position,
            direction,
            ..
        } = value;
        DirectedLocation {
            track,
            position,
            direction,
        }
    }
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "delimited_area",
    params(InfraIdParam),
    request_body = inline(DelimitedAreaResponse),
    responses(
        (status = 200, body = inline(DelimitedAreaResponse), description = "The track ranges between a list entries and exits." ),
    )
)]
/// Computes all tracks between a set of `entries` locations and a set of `exits` locations
///
/// Returns any track between one of the `entries` and one of the `exits`, i.e. any track that can
/// be reached from an entry before reaching an exit.
/// To prevent a missing exit to cause the graph traversal to never stop exploring, the exploration
/// stops when a maximum distance is reached and no exit has been found.
pub(in crate::views) async fn delimited_area(
    Extension(auth): AuthenticationExt,
    State(AppState {
        infra_caches,
        db_pool,
        ..
    }): State<AppState>,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Json(DelimitedAreaForm { entries, exits }): Json<DelimitedAreaForm>,
) -> Result<Json<DelimitedAreaResponse>> {
    // TODO in case of a missing exit, return an empty list of track ranges instead of returning all
    // the track ranges explored until the stopping condition ?
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Retrieve the infra
    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    let graph = Graph::load(&infra_cache);

    // Validate user input
    let (valid_entries, invalid_entries): (Vec<_>, Vec<_>) =
        entries
            .into_iter()
            .partition_map(|entry| match validate_location(&entry, &infra_cache) {
                Ok(_) => Either::Left(entry),
                Err(e) => Either::Right((entry, e)),
            });
    let (valid_exits, invalid_exits): (Vec<_>, Vec<_>) =
        exits
            .into_iter()
            .partition_map(|exit| match validate_location(&exit, &infra_cache) {
                Ok(_) => Either::Left(exit),
                Err(e) => Either::Right((exit, e)),
            });

    if !(invalid_exits.is_empty() && invalid_entries.is_empty()) {
        let invalid_locations = invalid_entries
            .into_iter()
            .chain(invalid_exits.into_iter())
            .collect::<Vec<_>>();
        return Err(DelimitedAreaError::InvalidLocations { invalid_locations }.into());
    }

    // Retrieve the track ranges

    Ok(Json(DelimitedAreaResponse {
        track_ranges: track_ranges_from_locations(valid_entries, valid_exits, &graph, &infra_cache),
    }))
}

/// Check whether a location is valid on a given infra cache, i.e. if it matches a track on the infra
/// and if it is within bounds.
fn validate_location(
    location: &DirectedLocation,
    infra_cache: &InfraCache,
) -> StdResult<(), InputError> {
    // Check if the location track exists on the infra

    let track_length = infra_cache
        .track_sections()
        .get(&location.track.0)
        .ok_or(InputError::TrackDoesNotExist(location.track.0.clone()))?
        .unwrap_track_section()
        .length;

    // Check if the location is within bounds on the track

    if location.position < 0. || track_length < location.position {
        Err(InputError::LocationOutOfBounds {
            track: location.track.0.clone(),
            position: location.position,
            track_length,
        })
    } else {
        Ok(())
    }
}

fn track_ranges_from_locations(
    entries: Vec<DirectedLocation>,
    exits: Vec<DirectedLocation>,
    graph: &Graph,
    infra_cache: &InfraCache,
) -> Vec<DirectionalTrackRange> {
    entries
        .iter()
        .flat_map(|entry| {
            impacted_tracks(
                entry,
                exits.iter().collect::<Vec<&DirectedLocation>>(),
                graph,
                infra_cache,
                MAXIMUM_DISTANCE,
            )
        })
        .collect::<Vec<_>>()
}

fn impacted_tracks(
    entry: &DirectedLocation,
    exits: Vec<&DirectedLocation>,
    graph: &Graph,
    infra_cache: &InfraCache,
    max_distance: f64,
) -> Vec<DirectionalTrackRange> {
    // Map track identifiers to their list of associated exits:
    let exits = {
        let mut tracks_to_exits: HashMap<&Identifier, Vec<&DirectedLocation>> = HashMap::new();
        for exit in exits {
            tracks_to_exits.entry(&exit.track).or_default().push(exit);
        }
        tracks_to_exits
    };

    // Directional track ranges reachable from `entry` during the graph exploration.
    let mut related_track_ranges: Vec<DirectionalTrackRange> = Vec::new();

    // TrackEndpoint right after the entry location (in the correct direction):
    let first_track_endpoint = TrackEndpoint {
        endpoint: match entry.direction {
            Direction::StartToStop => Endpoint::End,
            Direction::StopToStart => Endpoint::Begin,
        },
        track: entry.track.clone(),
    };

    if let Some(immediate_exit) = closest_exit_from_entry(entry, exits.get(&entry.track)) {
        let only_track_range = track_range_between_two_locations(entry, immediate_exit)
            .expect("Failed to build track range");
        return vec![only_track_range];
    } else {
        let first_track_length = infra_cache
            .track_sections()
            .get(&first_track_endpoint.track.0)
            .expect("Error while retrieving a track range from the infra cache")
            .unwrap_track_section()
            .length;
        let first_track_range = track_range_between_endpoint_and_location(
            entry,
            &first_track_endpoint,
            first_track_length,
            true,
        )
        .expect("Failed to build track range");
        related_track_ranges.push(first_track_range);
    };

    // Identifiers of the track sections that have already been reached and should be ignored:
    let mut visited_tracks: HashSet<&TrackEndpoint> = HashSet::new();

    // Neighbors of the explored tracks, i.e. the tracks that should be visited next:
    let mut next_tracks: Vec<(&TrackEndpoint, f64)> = Vec::new();
    let remaining_distance =
        max_distance - (related_track_ranges[0].end - related_track_ranges[0].begin);
    if 0. < remaining_distance {
        let neighbours = graph
            .get_all_neighbours(&first_track_endpoint)
            .into_iter()
            .map(|neighbour| (neighbour, remaining_distance))
            .collect::<Vec<_>>();
        next_tracks.extend(neighbours);
    }

    while let Some((curr_track_endpoint, remaining_distance)) = next_tracks.pop() {
        let curr_track_id = &curr_track_endpoint.track;

        if !visited_tracks.insert(curr_track_endpoint) {
            // Track already visited
            continue;
        }

        let track_length = infra_cache
            .track_sections()
            .get(&curr_track_endpoint.track.0)
            .expect("Error while retrieving a track range from the infra cache")
            .unwrap_track_section()
            .length;

        // Check if there is an exit location on that track range
        if let Some(exit) =
            closest_exit_from_endpoint(curr_track_endpoint, exits.get(&curr_track_id))
        {
            // End the search on that track, add the current track with the correct offset
            let track_range = track_range_between_endpoint_and_location(
                exit,
                curr_track_endpoint,
                track_length,
                false,
            )
            .expect("Failed to build track range");
            related_track_ranges.push(track_range);
        } else {
            let track_range =
                track_range_from_endpoint(curr_track_endpoint, remaining_distance, track_length)
                    .expect("Failed to build track range");
            let neighbours_remaining_distance =
                remaining_distance - (track_range.end - track_range.begin);
            related_track_ranges.push(track_range);
            if 0. < neighbours_remaining_distance {
                let opposite_track_endpoint = TrackEndpoint {
                    endpoint: match curr_track_endpoint.endpoint {
                        Endpoint::Begin => Endpoint::End,
                        Endpoint::End => Endpoint::Begin,
                    },
                    track: curr_track_endpoint.track.clone(),
                };
                let neighbours = graph
                    .get_all_neighbours(&opposite_track_endpoint)
                    .into_iter()
                    .map(|neighbour| (neighbour, neighbours_remaining_distance))
                    .collect::<Vec<_>>();
                next_tracks.extend(neighbours);
            }
        }
    }
    related_track_ranges
}

/// Return the closest exit that applies on a track from a starting endpoint.
/// To be applicable, an exit must be in the correct direction.
fn closest_exit_from_endpoint<'a>(
    track_endpoint: &TrackEndpoint,
    exits: Option<&'a Vec<&DirectedLocation>>,
) -> Option<&'a DirectedLocation> {
    exits.map(|exits| {
        exits
            .iter()
            .filter(|exit| exit.track == track_endpoint.track)
            .filter(|exit| match track_endpoint.endpoint {
                Endpoint::Begin => exit.direction == Direction::StartToStop,
                Endpoint::End => exit.direction == Direction::StopToStart,
            })
            .sorted_by(
                |e_1, e_2| match (track_endpoint.endpoint, e_1.position < e_2.position) {
                    (Endpoint::Begin, true) | (Endpoint::End, false) => Ordering::Less,
                    (Endpoint::Begin, false) | (Endpoint::End, true) => Ordering::Greater,
                },
            )
            .map(|exit| &**exit)
            .next()
    })?
}

/// Return the closest applicable exit that is on the same track as the `entry`, or `None`.
/// if there is none.
fn closest_exit_from_entry<'a>(
    entry: &DirectedLocation,
    exits: Option<&'a Vec<&DirectedLocation>>,
) -> Option<&'a DirectedLocation> {
    exits.map(|exits| {
        exits
            .iter()
            .filter(|exit| exit.track == entry.track)
            .filter(|exit| entry.direction == exit.direction)
            .filter(|exit| match entry.direction {
                Direction::StartToStop => entry.position < exit.position,
                Direction::StopToStart => exit.position < entry.position,
            })
            .sorted_by(
                |e_1, e_2| match (entry.direction, e_1.position < e_2.position) {
                    (Direction::StartToStop, true) | (Direction::StopToStart, false) => {
                        Ordering::Less
                    }
                    (Direction::StartToStop, false) | (Direction::StopToStart, true) => {
                        Ordering::Greater
                    }
                },
            )
            .map(|exit| &**exit)
            .next()
    })?
}

/// Return the directional track range starting at `entry` finishing at `exit`, or an error
/// if no track range can be built from them.
fn track_range_between_two_locations(
    entry: &DirectedLocation,
    exit: &DirectedLocation,
) -> StdResult<DirectionalTrackRange, TrackRangeConstructionError> {
    let exit_before_entry = match entry.direction {
        Direction::StartToStop => exit.position < entry.position,
        Direction::StopToStart => entry.position < exit.position,
    };
    if entry.direction != exit.direction || exit_before_entry {
        Err(TrackRangeConstructionError::InvalidRelativeLocations)
    } else if entry.track != exit.track {
        Err(TrackRangeConstructionError::TrackIdentifierMismatch)
    } else {
        Ok(DirectionalTrackRange {
            track: entry.track.clone(),
            begin: f64::min(entry.position, exit.position),
            end: f64::max(entry.position, exit.position),
            direction: entry.direction,
        })
    }
}

/// Return the directional track range delimited by a location and a track endpoint.
/// Panics a valid track range on `infra_cache` cannot be built from `location` and `endpoint`.
fn track_range_between_endpoint_and_location(
    location: &DirectedLocation,
    endpoint: &TrackEndpoint,
    track_length: f64,
    entry: bool,
) -> StdResult<DirectionalTrackRange, TrackRangeConstructionError> {
    let mut location_on_correct_direction = !matches!(
        (location.direction, endpoint.endpoint),
        (Direction::StartToStop, Endpoint::End) | (Direction::StopToStart, Endpoint::Begin)
    );
    if entry {
        location_on_correct_direction = !location_on_correct_direction;
    }

    let same_track = location.track == endpoint.track;
    let location_inside_track = 0. <= location.position && location.position <= track_length;

    if !location_on_correct_direction {
        Err(TrackRangeConstructionError::InvalidRelativeLocations)
    } else if !same_track {
        Err(TrackRangeConstructionError::TrackIdentifierMismatch)
    } else if !location_inside_track {
        Err(TrackRangeConstructionError::LocationNotOnTrack)
    } else {
        let (begin_offset, end_offset) = match endpoint.endpoint {
            Endpoint::Begin => (0., location.position),
            Endpoint::End => (location.position, track_length),
        };
        let track_range = DirectionalTrackRange {
            track: location.track.clone(),
            begin: begin_offset,
            end: end_offset,
            direction: location.direction,
        };
        Ok(track_range)
    }
}

/// Build a directional track range starting at `track_endpoint` and stopping at the end of the track
/// range if it is shorter than `remaining_distance`, or at `remaining_distance` from `track_endpoint`
/// otherwise. Returns: the built track range or `None` if the track does not exist in `infra_cache`.
fn track_range_from_endpoint(
    track_endpoint: &TrackEndpoint,
    remaining_distance: f64,
    track_length: f64,
) -> StdResult<DirectionalTrackRange, TrackRangeConstructionError> {
    let direction = match track_endpoint.endpoint {
        Endpoint::Begin => Direction::StartToStop,
        Endpoint::End => Direction::StopToStart,
    };
    let track_range_length = if track_length < remaining_distance {
        track_length
    } else {
        remaining_distance
    };
    let (begin_offset, end_offset) = match direction {
        Direction::StartToStop => (0., track_range_length),
        Direction::StopToStart => (track_length - track_range_length, track_length),
    };
    Ok(DirectionalTrackRange {
        track: track_endpoint.track.clone(),
        begin: begin_offset,
        end: end_offset,
        direction,
    })
}

#[cfg(test)]
mod tests {
    use crate::models::Infra;
    use crate::models::fixtures::create_small_infra;
    use crate::views::infra::delimited_area::DelimitedAreaResponse;
    use crate::views::test_app::TestAppBuilder;
    use axum::http::StatusCode;

    use schemas::infra::Direction;
    use schemas::infra::DirectionalTrackRange;
    use serde_json::json;

    use super::DirectedLocation;

    /// Create a temporary speed limit through with a given signal list and `small_infra` id through
    /// the creation endpoint, then retrieve from the database the persisted track sections for that
    /// speed limit.
    async fn get_track_ranges_request(
        entries: Vec<DirectedLocation>,
        exits: Vec<DirectedLocation>,
    ) -> Vec<DirectionalTrackRange> {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;
        let request = app
            .get(&format!("/infra/{infra_id}/delimited_area"))
            .json(&json!({
                "infra_id": infra_id,
                "entries": entries,
                "exits": exits,
            }
            ));
        let DelimitedAreaResponse { track_ranges } = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        track_ranges
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn same_track_start_to_stop() {
        let entries = vec![DirectedLocation {
            track: "TH1".into(),
            position: 100.,
            direction: Direction::StartToStop,
        }];
        let exits = vec![DirectedLocation {
            track: "TH1".into(),
            position: 200.,
            direction: Direction::StartToStop,
        }];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![DirectionalTrackRange {
            track: "TH1".into(),
            begin: 100.,
            end: 200.,
            direction: Direction::StartToStop,
        }];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn same_track_stop_to_start() {
        let entries = vec![DirectedLocation {
            track: "TH1".into(),
            position: 200.,
            direction: Direction::StopToStart,
        }];
        let exits = vec![DirectedLocation {
            track: "TH1".into(),
            position: 100.,
            direction: Direction::StopToStart,
        }];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![DirectionalTrackRange {
            track: "TH1".into(),
            begin: 100.,
            end: 200.,
            direction: Direction::StopToStart,
        }];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn tunnel_on_two_tracks() {
        let entries = vec![DirectedLocation {
            track: "TF1".into(),
            position: 100.,
            direction: Direction::StopToStart,
        }];
        let exits = vec![DirectedLocation {
            track: "TF0".into(),
            position: 2.,
            direction: Direction::StopToStart,
        }];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TF1".into(),
                begin: 0.,
                end: 100.,
                direction: Direction::StopToStart,
            },
            DirectionalTrackRange {
                track: "TF0".into(),
                begin: 2.,
                end: 3.,
                direction: Direction::StopToStart,
            },
        ];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn both_point_switch_directions_get_explored() {
        let entries = vec![DirectedLocation {
            track: "TG1".into(),
            position: 100.,
            direction: Direction::StartToStop,
        }];
        let exits = vec![
            DirectedLocation {
                track: "TG3".into(),
                position: 50.,
                direction: Direction::StartToStop,
            },
            DirectedLocation {
                track: "TG4".into(),
                position: 150.,
                direction: Direction::StartToStop,
            },
        ];
        let mut retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let mut expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TG1".into(),
                begin: 100.,
                end: 4000.,
                direction: Direction::StartToStop,
            },
            DirectionalTrackRange {
                track: "TG3".into(),
                begin: 0.,
                end: 50.,
                direction: Direction::StartToStop,
            },
            DirectionalTrackRange {
                track: "TG4".into(),
                begin: 0.,
                end: 150.,
                direction: Direction::StartToStop,
            },
        ];
        expected_track_ranges.sort_by(|lhs, rhs| lhs.track.0.cmp(&rhs.track.0));
        retrieved_track_ranges.sort_by(|lhs, rhs| lhs.track.0.cmp(&rhs.track.0));
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn multiple_isolated_entry_signals() {
        let entries = vec![
            DirectedLocation {
                track: "TF1".into(),
                position: 100.,
                direction: Direction::StopToStart,
            },
            DirectedLocation {
                track: "TG1".into(),
                position: 100.,
                direction: Direction::StartToStop,
            },
        ];
        let exits = vec![
            DirectedLocation {
                track: "TF0".into(),
                position: 2.,
                direction: Direction::StopToStart,
            },
            DirectedLocation {
                track: "TG3".into(),
                position: 50.,
                direction: Direction::StartToStop,
            },
            DirectedLocation {
                track: "TG4".into(),
                position: 150.,
                direction: Direction::StartToStop,
            },
        ];
        let mut retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let mut expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TF1".into(),
                begin: 0.,
                end: 100.,
                direction: Direction::StopToStart,
            },
            DirectionalTrackRange {
                track: "TF0".into(),
                begin: 2.,
                end: 3.,
                direction: Direction::StopToStart,
            },
            DirectionalTrackRange {
                track: "TG1".into(),
                begin: 100.,
                end: 4000.,
                direction: Direction::StartToStop,
            },
            DirectionalTrackRange {
                track: "TG3".into(),
                begin: 0.,
                end: 50.,
                direction: Direction::StartToStop,
            },
            DirectionalTrackRange {
                track: "TG4".into(),
                begin: 0.,
                end: 150.,
                direction: Direction::StartToStop,
            },
        ];
        expected_track_ranges.sort_by(|lhs, rhs| lhs.track.0.cmp(&rhs.track.0));
        retrieved_track_ranges.sort_by(|lhs, rhs| lhs.track.0.cmp(&rhs.track.0));
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn signals_facing_opposite_direction_are_ignored() {
        let entries = vec![DirectedLocation {
            track: "TF1".into(),
            position: 100.,
            direction: Direction::StopToStart,
        }];
        let exits = vec![
            DirectedLocation {
                track: "TF0".into(),
                position: 2.,
                direction: Direction::StartToStop,
            },
            DirectedLocation {
                track: "TF0".into(),
                position: 1.,
                direction: Direction::StopToStart,
            },
        ];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TF1".into(),
                begin: 0.,
                end: 100.,
                direction: Direction::StopToStart,
            },
            DirectionalTrackRange {
                track: "TF0".into(),
                begin: 1.,
                end: 3.,
                direction: Direction::StopToStart,
            },
        ];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn track_range_is_built_from_the_closest_exit() {
        let entries = vec![DirectedLocation {
            track: "TF1".into(),
            position: 100.,
            direction: Direction::StopToStart,
        }];
        let exits = vec![
            DirectedLocation {
                track: "TF0".into(),
                position: 2.,
                direction: Direction::StopToStart,
            },
            DirectedLocation {
                track: "TF0".into(),
                position: 1.,
                direction: Direction::StopToStart,
            },
        ];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TF1".into(),
                begin: 0.,
                end: 100.,
                direction: Direction::StopToStart,
            },
            DirectionalTrackRange {
                track: "TF0".into(),
                begin: 2.,
                end: 3.,
                direction: Direction::StopToStart,
            },
        ];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn exit_before_entry_is_ignored() {
        // The graph exploration should not stop if there is an exit signal on the same track
        // as the entry signal when the exit signal is behind the entry signal.
        let entries = vec![DirectedLocation {
            track: "TF1".into(),
            position: 100.,
            direction: Direction::StopToStart,
        }];
        let exits = vec![
            DirectedLocation {
                track: "TF1".into(),
                position: 150.,
                direction: Direction::StopToStart,
            },
            DirectedLocation {
                track: "TF0".into(),
                position: 2.,
                direction: Direction::StopToStart,
            },
        ];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TF1".into(),
                begin: 0.,
                end: 100.,
                direction: Direction::StopToStart,
            },
            DirectionalTrackRange {
                track: "TF0".into(),
                begin: 2.,
                end: 3.,
                direction: Direction::StopToStart,
            },
        ];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn closest_exit_ignores_exits_before_entry() {
        // If the LTV is a single track range, it should ignore the signals behind it when
        // checking which one is the closest.
        let entries = vec![DirectedLocation {
            track: "TF1".into(),
            position: 400.,
            direction: Direction::StopToStart,
        }];
        let exits = vec![
            DirectedLocation {
                track: "TF1".into(),
                position: 500.,
                direction: Direction::StopToStart,
            },
            DirectedLocation {
                track: "TF1".into(),
                position: 100.,
                direction: Direction::StopToStart,
            },
        ];
        let retrieved_track_ranges = get_track_ranges_request(entries, exits).await;
        let expected_track_ranges = vec![DirectionalTrackRange {
            track: "TF1".into(),
            begin: 100.,
            end: 400.,
            direction: Direction::StopToStart,
        }];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn exploration_stops_when_resume_signal_is_missing_and_maximum_distance_is_reached() {
        let entries = vec![DirectedLocation {
            track: "TE0".into(),
            position: 500.,
            direction: Direction::StartToStop,
        }];
        let mut retrieved_track_ranges = get_track_ranges_request(entries, vec![]).await;
        let mut expected_track_ranges = vec![
            DirectionalTrackRange {
                track: "TE0".into(),
                begin: 500.,
                end: 1500.,
                direction: Direction::StartToStop,
            },
            DirectionalTrackRange {
                track: "TF0".into(),
                begin: 0.,
                end: 3.,
                direction: Direction::StartToStop,
            },
            DirectionalTrackRange {
                track: "TF1".into(),
                begin: 0.,
                end: 3997.,
                direction: Direction::StartToStop,
            },
        ];
        expected_track_ranges.sort_by(|lhs, rhs| lhs.track.0.cmp(&rhs.track.0));
        retrieved_track_ranges.sort_by(|lhs, rhs| lhs.track.0.cmp(&rhs.track.0));
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[ignore]
    async fn track_section_can_be_explored_in_both_directions() {
        // TODO find a way to test it on small_infra or make a specific infra for this test
        todo!()
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[ignore]
    async fn adjacent_track_ranges_are_merged() {
        // If two directional track ranges are adjacent and have the same direction,
        // they should be merged into a single bigger directional track range.
        // N.B. This is mostly a performance issue.
        unimplemented!();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[ignore]
    async fn request_with_invalid_locations_is_rejected() {
        // Invalid locations (invalid track number, location position not on the track...)
        // get rejected with a 400 error code and the response contains context about
        // which locations were invalid and how they were invalid.
        todo!()
    }
}
