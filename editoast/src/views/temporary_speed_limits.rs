use axum::extract::Json;
use axum::extract::State;
use axum::Extension;
use chrono::NaiveDateTime;
use chrono::Utc;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::{Direction, Endpoint, TrackEndpoint};
use editoast_schemas::infra::{DirectionalTrackRange, Sign};
use editoast_schemas::primitives::Identifier;
use itertools::Itertools;
use serde::de::Error as SerdeError;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::iter::Extend;
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::models::temporary_speed_limits::TemporarySpeedLimit;
use crate::models::temporary_speed_limits::TemporarySpeedLimitGroup;
use crate::models::Changeset;
use crate::models::Infra;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use crate::Create;
use crate::CreateBatch;
use crate::Model;
use crate::Retrieve;
use editoast_authz::BuiltinRole;

use super::infra::InfraApiError;

crate::routes! {
    "/temporary_speed_limit_group" => create_temporary_speed_limit_group,
}

// Maximum distance the graph can be explored from a speed limit execution signal
// without finding any legitimate ending to the speed limit before it is considered
// there is not valid limit on the portion of the graph that is being explored.
// TODO Magic number for now. Make it configurable ?
#[cfg(not(test))]
const MAXIMUM_DISTANCE: f64 = 80000.;
#[cfg(test)]
const MAXIMUM_DISTANCE: f64 = 5000.;

#[derive(Serialize, ToSchema)]
struct TemporarySpeedLimitItemForm {
    start_date_time: NaiveDateTime,
    end_date_time: NaiveDateTime,
    signals: Vec<Sign>,
    speed_limit: f64,
    obj_id: String,
}

struct TemporarySpeedLimitImport {
    start_date_time: NaiveDateTime,
    end_date_time: NaiveDateTime,
    track_ranges: Vec<DirectionalTrackRange>,
    speed_limit: f64,
    obj_id: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct TemporarySpeedLimitCreateForm {
    speed_limit_group_name: String,
    infra_id: i64,
    #[schema(inline)]
    speed_limits: Vec<TemporarySpeedLimitItemForm>,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct TemporarySpeedLimitCreateResponse {
    group_id: i64,
}

impl TemporarySpeedLimitImport {
    fn into_temporary_speed_limit_changeset(
        self,
        temporary_speed_limit_group_id: i64,
    ) -> Changeset<TemporarySpeedLimit> {
        TemporarySpeedLimit::changeset()
            .start_date_time(self.start_date_time)
            .end_date_time(self.end_date_time)
            .track_ranges(self.track_ranges)
            .speed_limit(self.speed_limit)
            .obj_id(self.obj_id)
            .temporary_speed_limit_group_id(temporary_speed_limit_group_id)
    }

    fn from_temporary_speed_limit_item(
        speed_limit: TemporarySpeedLimitItemForm,
        graph: &Graph,
        infra_cache: &InfraCache,
    ) -> Self {
        let track_ranges: Vec<DirectionalTrackRange> =
            track_ranges_from_signals(speed_limit.signals, graph, infra_cache);
        TemporarySpeedLimitImport {
            start_date_time: speed_limit.start_date_time,
            end_date_time: speed_limit.end_date_time,
            track_ranges,
            speed_limit: speed_limit.speed_limit,
            obj_id: speed_limit.obj_id,
        }
    }
}

/// Retrieve from the infrastructure the track sections which match a list of temporary speed limit
/// signals. The input signals vector is expected to contain valid temporary speed limit signals,
/// i.e. signals which sign type is either `E` (for `Execution`) or `R` (for `Resume`).
fn track_ranges_from_signals(
    signals: Vec<Sign>,
    graph: &Graph,
    infra_cache: &InfraCache,
) -> Vec<DirectionalTrackRange> {
    // TODO merge adjacent directional track ranges
    let (execution_signals, resume_signals): (Vec<_>, Vec<_>) = signals
        .into_iter()
        .filter(|s| s.sign_type == "E".into() || s.sign_type == "R".into())
        .partition(|s| s.sign_type == "E".into());
    let mut speed_limit_track_ranges: Vec<DirectionalTrackRange> = Vec::new();
    execution_signals.into_iter().for_each(|start_signal| {
        speed_limit_track_ranges.extend(impacted_tracks(
            &start_signal,
            resume_signals.iter().collect::<Vec<&Sign>>(),
            graph,
            infra_cache,
            MAXIMUM_DISTANCE,
        ))
    });
    speed_limit_track_ranges
}

/// Do a graph traversal from `entry` up to any of the `exits` and return the visited track ranges
/// which correspond to the track ranges impacted by the temporary speed limit.
/// For a given resume signal, a valid exit is:
///     - A resume signal.
///     - Another execution signal (which will define another temporary speed limit and void the
///     current one).
/// The algorithm stops looking for more track ranges if the distance from `entry` to the track
/// range being currently explored track range exceeds the maximum distance defined, so that a
/// missing `exit` signal in a given direction does not cause the temporary speed limit to keep
/// exploring the whole infrastructure.
/// # Parameters:
/// - `entry`: The entry point of the LTV.
/// - `exits`: any valid exit for the LTV, i.e. any signal that exists in the infrastructure (does
///   this mean we need to persist signals ? If we take any signal as a valid stop case we need to
///   consider the signals related to already imported LTVs, and they are not present anymore in the
///   current import request.)
/// - `max_distance`: The maximum distance (in meters ?) after which we consider the exit signal is
///   missing and we stop adding new track ranges from the current path.
fn impacted_tracks(
    entry: &Sign,
    exits: Vec<&Sign>,
    graph: &Graph,
    infra_cache: &InfraCache,
    max_distance: f64,
) -> Vec<DirectionalTrackRange> {
    // TODO allow exploration of tracks in both directions (when coming back to a track already
    //      explored in the other direction)

    // Map track identifiers to their list of associated exits:
    let mut tracks_to_exits: HashMap<&Identifier, Vec<&Sign>> = HashMap::new();
    exits.into_iter().for_each(|exit| {
        let track_id = &exit.track;
        if let Some(track_exits) = tracks_to_exits.get_mut(track_id) {
            track_exits.push(exit);
        } else {
            let track_exits = vec![exit];
            tracks_to_exits.insert(track_id, track_exits);
        };
    });
    let exits = tracks_to_exits;

    // Directional track ranges reachable from `entry` during the graph exploration.
    let mut related_track_ranges: Vec<DirectionalTrackRange> = Vec::new();

    // TrackEndpoint right after the entry sign (in the correct direction):
    let first_track_endpoint = TrackEndpoint {
        endpoint: match entry.direction {
            Direction::StartToStop => Endpoint::End,
            Direction::StopToStart => Endpoint::Begin,
        },
        track: entry.track.clone(),
    };

    if let Some(immediate_exit) = closest_exit_from_entry(entry, exits.get(&entry.track)) {
        if let Some(only_track_range) = track_range_between_two_signs(entry, immediate_exit) {
            return vec![only_track_range];
        } else {
            return vec![];
        }
    } else if let Some(first_track_range) =
        track_range_between_endpoint_and_sign(entry, &first_track_endpoint, infra_cache, true)
    {
        related_track_ranges.push(first_track_range);
    } else {
        return vec![];
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

        // Check if there is a resume signal on that track range
        if let Some(exit) =
            closest_exit_from_endpoint(curr_track_endpoint, exits.get(&curr_track_id))
        {
            // End the search on that track, add the current track with the correct offset
            let track_range = track_range_between_endpoint_and_sign(
                exit,
                curr_track_endpoint,
                infra_cache,
                false,
            )
            .unwrap_or_else(|| {
                panic!(
                    "Cannot form a track from {:?} and {:?}",
                    exit, curr_track_endpoint
                )
            });
            related_track_ranges.push(track_range);
        } else {
            let track_range =
                track_range_from_endpoint(curr_track_endpoint, remaining_distance, infra_cache)
                    .unwrap_or_else(|| {
                        panic!("Cannot form a track from {:?}", curr_track_endpoint)
                    });
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
    exits: Option<&'a Vec<&Sign>>,
) -> Option<&'a Sign> {
    if let Some(exits) = exits {
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
            .map(|sign| &**sign)
            .next()
    } else {
        None
    }
}

/// Return the closest applicable exit that is on the same track as the `entry` sign or `None`
/// if there is none.
fn closest_exit_from_entry<'a>(entry: &Sign, exits: Option<&'a Vec<&Sign>>) -> Option<&'a Sign> {
    if let Some(exits) = exits {
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
            .map(|sign| &**sign)
            .next()
    } else {
        None
    }
}

/// Return the directional track range starting at `entry` finishing at `exit`, or `None`
/// if no track range can be built from them.
fn track_range_between_two_signs(entry: &Sign, exit: &Sign) -> Option<DirectionalTrackRange> {
    let exit_before_entry = match entry.direction {
        Direction::StartToStop => exit.position < entry.position,
        Direction::StopToStart => entry.position < exit.position,
    };
    if entry.direction != exit.direction || entry.track != exit.track || exit_before_entry {
        return None;
    }
    Some(DirectionalTrackRange {
        track: entry.track.clone(),
        begin: f64::min(entry.position, exit.position),
        end: f64::max(entry.position, exit.position),
        direction: entry.direction,
    })
}

/// Return the directional track range delimited by a sign and a track endpoint, or `None` if no
/// track range can be built from them.
fn track_range_between_endpoint_and_sign(
    sign: &Sign,
    endpoint: &TrackEndpoint,
    infra_cache: &InfraCache,
    entry: bool,
) -> Option<DirectionalTrackRange> {
    let mut sign_on_correct_direction = matches!(
        (sign.direction, endpoint.endpoint),
        (Direction::StartToStop, Endpoint::End) | (Direction::StopToStart, Endpoint::Begin)
    );
    if entry {
        sign_on_correct_direction = !sign_on_correct_direction;
    }

    if sign_on_correct_direction {
        None
    } else if let Some(track) = infra_cache.track_sections().get(&sign.track.0) {
        let track_length = track.unwrap_track_section().length;
        let (begin_offset, end_offset) = match endpoint.endpoint {
            Endpoint::Begin => (0., sign.position),
            Endpoint::End => (sign.position, track_length),
        };
        let track_range = DirectionalTrackRange {
            track: sign.track.clone(),
            begin: begin_offset,
            end: end_offset,
            direction: sign.direction,
        };
        Some(track_range)
    } else {
        None
    }
}

/// Build a directional track range starting at `track_endpoint` and stopping at the end of the track
/// range if it is shorter than `remaining_distance`, or at `remaining_distance` from `track_endpoint`
/// otherwise. Returns: the built track range or `None` if the track does not exist in `infra_cache`.
fn track_range_from_endpoint(
    track_endpoint: &TrackEndpoint,
    remaining_distance: f64,
    infra_cache: &InfraCache,
) -> Option<DirectionalTrackRange> {
    if let Some(track) = infra_cache.track_sections().get(&track_endpoint.track.0) {
        let track_length = track.unwrap_track_section().length;
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
        Some(DirectionalTrackRange {
            track: track_endpoint.track.clone(),
            begin: begin_offset,
            end: end_offset,
            direction,
        })
    } else {
        None
    }
}

impl<'de> Deserialize<'de> for TemporarySpeedLimitItemForm {
    fn deserialize<D>(deserializer: D) -> StdResult<TemporarySpeedLimitItemForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Internal {
            start_date_time: NaiveDateTime,
            end_date_time: NaiveDateTime,
            signals: Vec<Sign>,
            speed_limit: f64,
            obj_id: String,
        }
        let Internal {
            start_date_time,
            end_date_time,
            signals,
            speed_limit,
            obj_id,
        } = Internal::deserialize(deserializer)?;

        // Validation checks

        if end_date_time <= start_date_time {
            return Err(SerdeError::custom(format!(
                "The temporary_speed_limit start date '{}' must be before the end date '{}'",
                start_date_time, end_date_time
            )));
        }

        if !signals.iter().any(|signal| signal.sign_type == "E".into()) {
            return Err(SerdeError::custom(
                "The temporary speed limit signals list must contain at least one execution signal.",
            ));
        }

        Ok(TemporarySpeedLimitItemForm {
            start_date_time,
            end_date_time,
            signals,
            speed_limit,
            obj_id,
        })
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "temporary_speed_limit")]
enum TemporarySpeedLimitError {
    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },
}

fn map_diesel_error(e: InternalError, name: impl AsRef<str>) -> InternalError {
    if e.message.contains(
        r#"duplicate key value violates unique constraint "temporary_speed_limit_group_name_key""#,
    ) {
        TemporarySpeedLimitError::NameAlreadyUsed {
            name: name.as_ref().to_string(),
        }
        .into()
    } else {
        e
    }
}

#[utoipa::path(
    post, path = "",
    tag = "temporary_speed_limits",
    request_body = inline(TemporarySpeedLimitCreateForm),
    responses(
        (status = 201, body = inline(TemporarySpeedLimitCreateResponse), description = "The id of the created temporary speed limit group." ),
    )
)]
async fn create_temporary_speed_limit_group(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    State(app_state): State<AppState>,
    Json(TemporarySpeedLimitCreateForm {
        speed_limit_group_name,
        infra_id,
        speed_limits,
    }): Json<TemporarySpeedLimitCreateForm>,
) -> Result<Json<TemporarySpeedLimitCreateResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    // Create the speed limits group
    let TemporarySpeedLimitGroup { id: group_id, .. } = TemporarySpeedLimitGroup::changeset()
        .name(speed_limit_group_name.clone())
        .creation_date(Utc::now().naive_utc())
        .create(conn)
        .await
        .map_err(|e| map_diesel_error(e, speed_limit_group_name))?;

    // Retrieve the infra

    let infra_caches = app_state.infra_caches.clone();
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let graph = Graph::load(&infra_cache);

    // Create the speed limits
    let speed_limits_changesets = speed_limits
        .into_iter()
        .map(|speed_limit| {
            TemporarySpeedLimitImport::from_temporary_speed_limit_item(
                speed_limit,
                &graph,
                &infra_cache,
            )
        })
        .map(|speed_limit| speed_limit.into_temporary_speed_limit_changeset(group_id))
        .collect::<Vec<_>>();
    let _: Vec<_> = TemporarySpeedLimit::create_batch(conn, speed_limits_changesets).await?;

    Ok(Json(TemporarySpeedLimitCreateResponse { group_id }))
}

#[cfg(test)]
mod tests {
    use crate::models::infra::Infra;
    use crate::{
        models::{fixtures::create_small_infra, temporary_speed_limits::TemporarySpeedLimitGroup},
        views::test_app::TestApp,
        List, Retrieve, SelectionSettings,
    };
    use axum::http::StatusCode;
    use axum_test::TestRequest;
    use chrono::{Duration, NaiveDateTime, Utc};
    use editoast_schemas::infra::{Direction, DirectionalTrackRange};
    use rand;
    use rstest::rstest;
    use serde_json::{json, Value};
    use uuid::Uuid;

    use crate::{
        models::temporary_speed_limits::TemporarySpeedLimit,
        views::{
            temporary_speed_limits::TemporarySpeedLimitCreateResponse, test_app::TestAppBuilder,
        },
    };

    struct TimePeriod {
        start_date_time: NaiveDateTime,
        end_date_time: NaiveDateTime,
    }

    impl TestApp {
        fn create_temporary_speed_limit_group_request(
            &self,
            parameters: RequestParameters,
        ) -> TestRequest {
            let RequestParameters {
                group_name,
                infra_id,
                obj_id,
                time_period:
                    TimePeriod {
                        start_date_time,
                        end_date_time,
                    },
                signals,
            } = parameters;
            self.post("/temporary_speed_limit_group").json(&json!(
                    {
                        "speed_limit_group_name": group_name,
                        "infra_id": infra_id,
                        "speed_limits": [                    {
                            "start_date_time": start_date_time,
                            "end_date_time": end_date_time,
                            "signals": signals,
                            "speed_limit": 80.,
                            "obj_id": obj_id,
                        }]
                    }
            ))
        }
    }

    struct RequestParameters {
        group_name: String,
        infra_id: i64,
        obj_id: String,
        time_period: TimePeriod,
        signals: Value,
    }

    impl RequestParameters {
        fn new(infra_id: i64) -> Self {
            RequestParameters {
                group_name: Uuid::new_v4().to_string(),
                infra_id,
                obj_id: Uuid::new_v4().to_string(),
                time_period: TimePeriod {
                    start_date_time: Utc::now().naive_utc(),
                    end_date_time: Utc::now().naive_utc() + Duration::days(1),
                },
                signals: json!(
                [
                    {
                        "track": Uuid::new_v4(),
                        "position": rand::random::<f64>(),
                        "side": "LEFT",
                        "direction": "START_TO_STOP",
                        "type": "E",
                        "value": Uuid::new_v4(),
                        "kp": "147+292",
                    },
                    {
                        "track": Uuid::new_v4(),
                        "position": rand::random::<f64>(),
                        "side": "LEFT",
                        "direction": "START_TO_STOP",
                        "type": "R",
                        "value": Uuid::new_v4(),
                        "kp": "147+292",
                    }
                ]),
            }
        }

        fn with_group_name(mut self, group_name: String) -> Self {
            self.group_name = group_name;
            self
        }

        fn with_obj_id(mut self, obj_id: String) -> Self {
            self.obj_id = obj_id;
            self
        }

        fn with_time_period(mut self, time_period: TimePeriod) -> Self {
            self.time_period = time_period;
            self
        }

        fn with_signals(mut self, signals: Value) -> Self {
            self.signals = signals;
            self
        }
    }

    #[rstest]
    async fn create_temporary_speed_limits_succeeds() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let group_name = Uuid::new_v4().to_string();
        let request_obj_id = Uuid::new_v4().to_string();

        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id)
                .with_group_name(group_name.clone())
                .with_obj_id(request_obj_id.clone()),
        );

        // Speed limit group checks

        let TemporarySpeedLimitCreateResponse { group_id } =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let created_group = TemporarySpeedLimitGroup::retrieve(&mut pool.get_ok(), group_id)
            .await
            .expect("Failed to retrieve the created temporary speed limit group")
            .expect("No temporary speed limit group matches the group identifier of the endpoint response");

        assert_eq!(created_group.name, group_name);

        // Speed limit checks

        let selection_settings: SelectionSettings<TemporarySpeedLimit> = SelectionSettings::new()
            .filter(move || TemporarySpeedLimit::TEMPORARY_SPEED_LIMIT_GROUP_ID.eq(group_id));
        let created_speed_limits: Vec<TemporarySpeedLimit> =
            TemporarySpeedLimit::list(&mut pool.get_ok(), selection_settings)
                .await
                .expect("Failed to retrieve temporary speed limits from the database");

        assert_eq!(created_speed_limits.len(), 1);
        let TemporarySpeedLimit { obj_id, .. } = &created_speed_limits[0];
        assert_eq!(obj_id, &request_obj_id);
    }

    #[rstest]
    async fn create_temporary_speed_limit_groups_with_identical_name_fails() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;

        let group_name = Uuid::new_v4().to_string();
        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id).with_group_name(group_name.clone()),
        );
        let _ = app.fetch(request).assert_status(StatusCode::OK);

        let request =
            app.create_temporary_speed_limit_group_request(RequestParameters::new(infra_id));
        let _ = app.fetch(request).assert_status(StatusCode::OK);

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id).with_group_name(group_name.clone()),
        );
        let _ = app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn create_ltv_with_invalid_invalid_time_period_fails() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;

        let time_period = TimePeriod {
            start_date_time: Utc::now().naive_utc() + Duration::days(1),
            end_date_time: Utc::now().naive_utc(),
        };

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id).with_time_period(time_period),
        );

        let _ = app
            .fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[rstest]
    async fn create_ltv_with_no_signals_fails() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id).with_signals(json!([])),
        );

        let _ = app
            .fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[rstest]
    async fn create_ltv_with_no_execution_signals_fails() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id).with_signals(json!([
                {
                    "track": Uuid::new_v4(),
                    "position": rand::random::<f64>(),
                    "side": "LEFT",
                    "direction": "START_TO_STOP",
                    "type": "R",
                    "value": Uuid::new_v4(),
                    "kp": "147+292",

                },
            ])),
        );

        let _ = app
            .fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }

    // Signals to tracks conversion tests

    /// Create a temporary speed limit through with a given signal list and `small_infra` id through
    /// the creation endpoint, then retrieve from the database the persisted track sections for that
    /// speed limit.
    async fn retrieve_track_ranges_from_signals(signals: Value) -> Vec<DirectionalTrackRange> {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let Infra { id: infra_id, .. } = create_small_infra(&mut pool.get_ok()).await;
        let speed_limit_obj_id = Uuid::new_v4().to_string();
        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new(infra_id)
                .with_obj_id(speed_limit_obj_id.clone())
                .with_signals(signals),
        );

        let TemporarySpeedLimitCreateResponse { group_id } =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let selection_settings: SelectionSettings<TemporarySpeedLimit> = SelectionSettings::new()
            .filter(move || TemporarySpeedLimit::TEMPORARY_SPEED_LIMIT_GROUP_ID.eq(group_id));
        let mut created_speed_limits: Vec<TemporarySpeedLimit> =
            TemporarySpeedLimit::list(&mut pool.get_ok(), selection_settings)
                .await
                .expect("Failed to retrieve temporary speed limits from the database");

        assert_eq!(created_speed_limits.len(), 1);
        let TemporarySpeedLimit { track_ranges, .. } = created_speed_limits.pop().unwrap();
        track_ranges
    }

    #[rstest]
    async fn same_track_start_to_stop() {
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TH1",
                "position": 100.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TH1",
                "position": 200.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            }
        ]))
        .await;
        let expected_track_ranges = vec![DirectionalTrackRange {
            track: "TH1".into(),
            begin: 100.,
            end: 200.,
            direction: Direction::StartToStop,
        }];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[rstest]
    async fn same_track_stop_to_start() {
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TH1",
                "position": 200.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TH1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            }
        ]))
        .await;
        let expected_track_ranges = vec![DirectionalTrackRange {
            track: "TH1".into(),
            begin: 100.,
            end: 200.,
            direction: Direction::StopToStart,
        }];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[rstest]
    async fn tunnel_on_two_tracks() {
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TF1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 2.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    async fn both_point_switch_directions_get_explored() {
        let mut retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TG1",
                "position": 100.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TG3",
                "position": 50.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TG4",
                "position": 150.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    async fn multiple_isolated_entry_signals() {
        let mut retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TF1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 2.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TG1",
                "position": 100.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TG3",
                "position": 50.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TG4",
                "position": 150.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    async fn signals_facing_opposite_direction_are_ignored() {
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TF1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 2.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 1.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    async fn track_range_is_built_from_the_closest_exit() {
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TF1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 2.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 1.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    async fn exit_before_entry_is_ignored() {
        // The graph exploration should not stop if there is an exit signal on the same track
        // as the entry signal when the exit signal is behind the entry signal.
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TF1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF1",
                "position": 150.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF0",
                "position": 2.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    async fn closest_exit_ignores_exits_before_entry() {
        // If the LTV is a single track range, it should ignore the signals behind it when
        // checking which one is the closest.
        let retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TF1",
                "position": 400.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF1",
                "position": 500.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
            {
                "track": "TF1",
                "position": 100.,
                "side": "LEFT",
                "direction": "STOP_TO_START",
                "type": "R",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
        let expected_track_ranges = vec![DirectionalTrackRange {
            track: "TF1".into(),
            begin: 100.,
            end: 400.,
            direction: Direction::StopToStart,
        }];
        assert_eq!(expected_track_ranges, retrieved_track_ranges);
    }

    #[rstest]
    async fn exploration_stops_when_resume_signal_is_missing_and_maximum_distance_is_reached() {
        let mut retrieved_track_ranges = retrieve_track_ranges_from_signals(json!([
            {
                "track": "TE0",
                "position": 500.,
                "side": "LEFT",
                "direction": "START_TO_STOP",
                "type": "E",
                "value": Uuid::new_v4(),
                "kp": String::new(),
            },
        ]))
        .await;
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

    #[rstest]
    #[ignore]
    async fn track_section_can_be_explored_in_both_directions() {
        // TODO find a way to test it on small_infra or make a specific infra for this test
        todo!()
    }

    #[rstest]
    #[ignore]
    async fn adjacent_track_ranges_are_merged() {
        // If two directional track ranges are adjacent and have the same direction,
        // they should be merged into a single bigger directional track range.
        // N.B. This is mostly a performance issue.
        unimplemented!();
    }
}
