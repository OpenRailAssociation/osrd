//! Finds similar train schedules for a given train path and rolling stock.
//!
//! This module implements an algorithm to identify train schedules that closely match a new train's
//! waypoints and characteristics. It works in these steps:
//!
//! 1. **Validate Inputs**: Checks if the rolling stock and speed limit tag exist.
//! 2. **Query Candidates**: Finds train schedules in the given timetable with matching rolling stock
//!    and stops at the new train's segment endpoints.
//! 3. **Simulate Trains**: Computes the path properties of candidate train schedules to confirm their routes.
//! 4. **Build Graphs**: Creates a graph for each segment, mapping waypoints of past trains.
//! 5. **Find Matches**: Identifies past trains that cover each segment of the new train's path.
//! 6. **Select Best Trains**: Chooses the smallest set of past trains that cover all segments.
//! 7. **Build Response**: Formats the results.
//!
//! The result is a list of similar train segments with their train ids and start times.

mod graph;
mod new_train;
mod past_train;

use std::collections::HashMap;
use std::collections::HashSet;
use std::ops::Deref;
use std::sync::Arc;

use arcstr::ArcStr;
use authz::Role;
use axum::Extension;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Utc;
use core_client::CoreClient;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use database::DbConnection;
use derive_more::Deref;
use derive_more::Display;
use editoast_derive::EditoastError;
use itertools::Itertools as _;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::models;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::timetable::Timetable;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::timetable::similar_trains::graph::AdvancementError;
use crate::views::timetable::similar_trains::graph::AdvancementErrorKind;
use editoast_models::prelude::*;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

// Simulation layer struct, not a view struct, to move in some mod.rs when the simulation crate will be there
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Display, Deref)]
struct OperationalPoint(ArcStr);

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize, PartialEq))]
#[serde(remote = "Self")]
struct RollingStockCharacteristics {
    name: Option<String>,
    speed_limit_tag: Option<String>,
}

impl<'de> Deserialize<'de> for RollingStockCharacteristics {
    fn deserialize<D>(deserializer: D) -> std::result::Result<RollingStockCharacteristics, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let characteristics = RollingStockCharacteristics::deserialize(deserializer)?;

        if characteristics.name.is_none() && characteristics.speed_limit_tag.is_none() {
            return Err(serde::de::Error::custom(
                "Both 'name' and 'speed_limit_tag' are missing; at least one must be provided.",
            ));
        }

        Ok(characteristics)
    }
}

#[cfg(test)]
impl Serialize for RollingStockCharacteristics {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        RollingStockCharacteristics::serialize(self, serializer)
    }
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq, Serialize))]
#[schema(as = SimilarTrainWaypoint)]
struct Waypoint {
    #[schema(value_type = String)]
    id: ArcStr,
    stop: bool,
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}{}", self.id, if self.stop { "[STOP]" } else { "" },)
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize))]
pub(in crate::views) struct Request {
    #[schema(inline)]
    rolling_stock: RollingStockCharacteristics,
    waypoints: Vec<Waypoint>,
    infra_id: i64,
    timetable_id: i64,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
struct SimilarTrainItem {
    #[schema(inline)]
    /// `train` is `None` if no similar train
    /// was found for the segment; otherwise, it is `Some`.
    train: Option<TrainInfo>,
    #[schema(value_type = String)]
    begin: ArcStr,
    #[schema(value_type = String)]
    end: ArcStr,
}

#[derive(Debug, Serialize, ToSchema, Clone)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
struct TrainInfo {
    train_name: String,
    start_time: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct Response {
    #[schema(inline)]
    similar_trains: Vec<SimilarTrainItem>,
}

#[derive(Debug, thiserror::Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "timetable:similar_trains")]
enum SimilarTrainsError {
    #[error(transparent)]
    #[editoast_error(status = 400)]
    InvalidPath(#[from] new_train::InvalidTrain),

    #[error("Infra '{infra_id}' not found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },

    #[error("Timetable '{timetable_id}' not found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },

    #[error("Rolling stock '{rolling_stock_name}' does not exist")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_name: String },

    #[error("Speed limit tag '{speed_limit_tag}' does not exist")]
    #[editoast_error(status = 404)]
    SpeedLimitNotFound { speed_limit_tag: String },

    #[error("Database error")]
    #[editoast_error(status = 500)]
    #[from(forward)]
    Database(editoast_models::Error),
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tags = ["similar_trains", "stdcm", "sncf"],
    request_body = inline(Request),
    responses(
        (
            status = 200,
            description = "A combination of reference train identifiers similar to the provided train",
            body = inline(Response),
        ),
    ),
)]
pub(in crate::views) async fn similar_trains(
    Extension(auth): AuthenticationExt,
    State(AppState {
        db_pool,
        speed_limit_tag_ids,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Json(Request {
        rolling_stock,
        waypoints,
        infra_id,
        timetable_id,
    }): Json<Request>,
) -> Result<Json<Response>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let mut conn = db_pool.get().await?;

    // Step 1: input validation and preprocessing
    // ------------------------------------------

    validate_rolling_stock_input(&mut conn, &rolling_stock, &speed_limit_tag_ids).await?;

    if !Timetable::exists(&mut conn, timetable_id).await? {
        return Err(SimilarTrainsError::TimetableNotFound { timetable_id }.into());
    }

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        SimilarTrainsError::InfraNotFound { infra_id }
    })
    .await?;

    let waypoints = squash_successive_waypoints(waypoints);
    let wp_count = waypoints.len();
    let new_train_waypoints = waypoints.into_iter().map(|Waypoint { id, stop }| {
        if stop {
            new_train::Waypoint::stop(id)
        } else {
            new_train::Waypoint::passing_by(id)
        }
    });
    let new_train =
        new_train::NewTrain::new(new_train_waypoints).map_err(SimilarTrainsError::from)?;

    tracing::debug!(
        n_segments = new_train.segment_endpoints().count(),
        n_waypoints = wp_count,
        "pre-processing complete"
    );

    // Step 2: query candidate train schedules
    // ---------------------------------------

    let candidate_schedules = search_candidate_train_schedules(
        &mut conn,
        &new_train,
        timetable_id,
        infra_id,
        rolling_stock,
    )
    .await?;
    if candidate_schedules.is_empty() {
        tracing::info!("no candidate train schedules found — similar trains cannot be computed");
        return Ok(Json(Response {
            similar_trains: vec![SimilarTrainItem {
                train: None,
                begin: new_train.begin().op.deref().clone(),
                end: new_train.end().op.deref().clone(),
            }],
        }));
    }

    // keep the departure date in memory in order to build the API response later on
    let candidate_schedules_response_info = candidate_schedules
        .iter()
        .map(|ts| {
            (
                ts.id,
                TrainInfo {
                    train_name: ts.train_name.clone(),
                    start_time: ts.start_time,
                },
            )
        })
        .collect::<HashMap<_, _>>();

    // Step 3 : simulate candidate train schedules
    // -------------------------------------------

    let selected_past_trains = simulate_past_trains(
        &mut conn,
        valkey_client,
        core_client,
        &infra,
        candidate_schedules,
        config.app_version.as_deref(),
    )
    .await?;

    let pool = past_train::Pool::from_iter(selected_past_trains);

    // Step 4: build candidate paths graph for each segment
    // ------------------------------------------------------

    let mut graphs = Vec::new();
    for segment in new_train.into_segments() {
        let past_trains = pool.trains_in_segment(&segment);
        let mut graph = graph::Graph::default();
        for past_train in past_trains {
            let waypoints = past_train
                .clamp_path(&segment)
                .expect("past trains are selected to stop at segment endpoints");
            graph.push(past_train.id(), waypoints.iter().cloned());
        }
        graphs.push((segment, graph));
    }

    // Step 5: find all candidate past trains on the path of the new train's segment
    // -----------------------------------------------------------------------------

    let mut trains = Vec::new();
    for (segment, graph) in graphs {
        let begin = segment.begin().clone();
        let end = segment.end().clone();
        #[cfg(debug_assertions)]
        std::fs::write("/tmp/dot.txt", graph.to_dot()).unwrap();
        let mut state = match graph::MatchingState::try_new(segment, graph) {
            Ok(state) => state,
            Err(()) => {
                trains.push(((begin, end), HashSet::new()));
                continue;
            }
        };
        loop {
            match state.advance() {
                Ok(new_state) => state = new_state,
                Err(AdvancementError {
                    error: AdvancementErrorKind::ReachedPathEnding,
                    last_state: state,
                }) => {
                    tracing::debug!(
                        segment_begin = ?begin,
                        segment_end = ?end,
                        trains = ?state.correct_trains_so_far,
                        "similar trains found for segment"
                    );
                    trains.push(((begin, end), state.correct_trains_so_far));
                    break;
                }
                Err(AdvancementError {
                    error:
                        AdvancementErrorKind::IrremediablyBlocked {
                            current,
                            targeted,
                            skipped,
                        },
                    ..
                }) => {
                    tracing::error!(
                        ?current,
                        ?targeted,
                        ?skipped,
                        "exploration irremediably blocked"
                    );
                    break;
                }
            }
        }
    }

    // Step 6: determine which similar train to choose for each segment
    // ----------------------------------------------------------------

    let similar_trains = decide_best_train_combination(
        trains
            .iter()
            .map(|(_, trains)| trains)
            .filter(|trains| !trains.is_empty())
            .collect::<Vec<_>>(),
    );

    // Final step: build the API response
    // ----------------------------------

    let response_items = trains
        .into_iter()
        .map(|((begin, end), trains)| {
            let train_id = trains.intersection(&similar_trains).next().cloned();
            SimilarTrainItem {
                train: train_id
                    .as_ref()
                    .and_then(|train_id| candidate_schedules_response_info.get(train_id).cloned()),
                begin: begin.op.deref().clone(),
                end: end.op.deref().clone(),
            }
        })
        .collect();

    Ok(Json(Response {
        similar_trains: response_items,
    }))
}

async fn validate_rolling_stock_input(
    conn: &mut DbConnection,
    RollingStockCharacteristics {
        name,
        speed_limit_tag,
        ..
    }: &RollingStockCharacteristics,
    speed_limit_tag_ids: &SpeedLimitTagIds,
) -> Result<()> {
    if let Some(name) = name
        && !RollingStock::exists(conn, name.clone()).await?
    {
        return Err(SimilarTrainsError::RollingStockNotFound {
            rolling_stock_name: name.clone(),
        }
        .into());
    }

    if speed_limit_tag
        .as_ref()
        .is_some_and(|tag| !speed_limit_tag_ids.contains(tag))
    {
        return Err(SimilarTrainsError::SpeedLimitNotFound {
            speed_limit_tag: speed_limit_tag.as_ref().cloned().unwrap(),
        }
        .into());
    }

    Ok(())
}

fn squash_successive_waypoints(waypoints: Vec<Waypoint>) -> Vec<Waypoint> {
    let mut result = Vec::<Waypoint>::with_capacity(waypoints.len());
    for waypoint in waypoints {
        if let Some(prev) = result.last_mut()
            && prev.id == waypoint.id
        {
            prev.stop |= waypoint.stop;
            continue;
        }
        result.push(waypoint);
    }
    result
}

#[tracing::instrument(skip(conn, new_train), err)]
async fn search_candidate_train_schedules(
    conn: &mut DbConnection,
    new_train: &new_train::NewTrain,
    timetable_id: i64,
    infra_id: i64,
    RollingStockCharacteristics {
        name: rolling_stock_name,
        speed_limit_tag,
    }: RollingStockCharacteristics,
) -> Result<Vec<models::TrainSchedule>> {
    let filter = SelectionSettings::new()
        .filter(move || models::TrainSchedule::TIMETABLE_ID.eq(timetable_id))
        .order_by(|| models::TrainSchedule::ID.asc());

    let filter = if let Some(rolling_stock_name) = rolling_stock_name {
        filter.filter(move || {
            models::TrainSchedule::ROLLING_STOCK_NAME.eq(rolling_stock_name.clone())
        })
    } else {
        filter
    };

    let filter = if let Some(speed) = speed_limit_tag {
        filter.filter(move || models::TrainSchedule::SPEED_LIMIT_TAG.eq(Some(speed.clone())))
    } else {
        filter
    };

    let train_schedules = models::TrainSchedule::list(conn, filter).await?;

    tracing::debug!(
        n_train_schedules = train_schedules.len(),
        "candidate train schedules queried after applying rolling stock restrictions"
    );

    let path_locations = train_schedules
        .iter()
        .flat_map(models::TrainSchedule::iter_stops)
        .map(|path_item| &path_item.location)
        .collect_vec();
    let path_item_cache = PathItemCache::load(conn, infra_id, &path_locations).await?;

    let segments_stops = new_train
        .segment_endpoints()
        .map(|(stop1, stop2)| (stop1.op.clone(), stop2.op.clone()))
        .collect::<HashSet<_>>();

    let candidate_schedules =
        tracing::debug_span!("keeping train schedules stopping at segment ends").in_scope(|| {
            let mut candidates: Vec<models::TrainSchedule> = Default::default();
            for train_schedule in train_schedules {
                let retain_schedule = {
                    let mut stop_pairs_forming_a_segment = train_schedule
                        .iter_stops()
                        .flat_map(|p| path_item_cache.get_from_path_location(&p.location))
                        .tuple_windows()
                        .flat_map(|(ops1, ops2)| ops1.iter().cartesian_product(ops2.iter()))
                        .map(|(op1, op2)| {
                            (
                                OperationalPoint(op1.obj_id.clone().into()),
                                OperationalPoint(op2.obj_id.clone().into()),
                            )
                        })
                        .filter(|key| segments_stops.contains(key));
                    stop_pairs_forming_a_segment.next().is_some()
                };
                if retain_schedule {
                    candidates.push(train_schedule);
                }
            }
            tracing::debug!(
                n_candidates = candidates.len(),
                "candidate train schedules found"
            );
            candidates
        });

    Ok(candidate_schedules)
}

#[tracing::instrument(skip_all, fields(infra_id = infra.id, candidate_schedules = candidate_schedules.len()), err)]
async fn simulate_past_trains(
    conn: &mut DbConnection,
    valkey: Arc<cache::Client>,
    core_client: Arc<CoreClient>,
    infra: &Infra,
    candidate_schedules: Vec<models::TrainSchedule>,
    app_version: Option<&str>,
) -> Result<Vec<past_train::PastTrain>> {
    let rolling_stock_names = candidate_schedules
        .iter()
        .map(|ts| &ts.rolling_stock_name)
        .cloned()
        .collect_vec();
    let rolling_stocks = RollingStock::list(
        conn,
        SelectionSettings::new()
            .filter(move || models::RollingStock::NAME.eq_any(rolling_stock_names.clone())),
    )
    .await?
    .into_iter()
    .map(schemas::RollingStock::from)
    .collect_vec();

    let paths = {
        let paths = pathfinding_from_train_batch(
            conn.clone(),
            &mut valkey.get_connection().await?,
            core_client.clone(),
            infra,
            &candidate_schedules,
            &rolling_stocks,
            app_version,
        )
        .await?;
        paths
            .into_iter()
            .zip(candidate_schedules.iter())
            .filter_map(|(path, ts)| match path.as_ref() {
                PathfindingResult::Success(path) => Some(path.clone()),
                PathfindingResult::Failure(failure) => {
                    tracing::warn!(
                        ?failure,
                        train_schedule = ts.train_name,
                        train_schedule_id = ts.id,
                        "failed to compute path for train schedule, skipping it",
                    );
                    None
                }
            })
            .collect_vec()
    };

    let path_properties_requests = paths
        .iter()
        .map(|pathfinding_result| PathPropertiesRequest {
            track_section_ranges: &pathfinding_result.path.track_section_ranges,
            infra: infra.id,
            expected_version: infra.version,
        })
        .collect::<Vec<_>>();

    let mut valkey_conn = valkey.get_connection().await?;
    let path_properties = crate::views::path::properties::compute_path_properties_batch(
        core_client,
        &mut valkey_conn,
        &path_properties_requests,
        app_version,
    )
    .await?;

    let selected_past_trains = path_properties
        .zip(candidate_schedules.into_iter())
        .map(
            |(
                core_client::path_properties::PathPropertiesResponse {
                    operational_points, ..
                },
                ts,
            )| {
                let stop_ids = ts
                    .iter_stops()
                    .flat_map(|path_item| match path_item.location.identifier() {
                        Some(id) => Some(OperationalPoint(id.into())),
                        None => {
                            tracing::warn!(
                                ts.id,
                                ?path_item,
                                "ignoring non ID-referenced path item"
                            );
                            None
                        }
                    })
                    .collect::<HashSet<_>>();
                let ops =
                    operational_points
                        .into_iter()
                        .map(|OperationalPointOnPath { id, .. }| {
                            let op = OperationalPoint(id.as_str().into());
                            let stop = stop_ids.contains(&op);
                            graph::Waypoint { stop, op }
                        });
                past_train::PastTrain::new(ts.id, ops)
            },
        )
        .collect_vec();

    Ok(selected_past_trains)
}

// TODO: minimize the number of trains to duplicate or minimize the disjoint segments in the simulation sheet?
#[tracing::instrument(ret(level = "debug"))]
fn decide_best_train_combination(
    mut segments_trains: Vec<&HashSet<past_train::Id>>,
) -> HashSet<past_train::Id> {
    let mut trains = HashSet::default();

    while !segments_trains.is_empty() {
        let longest_train = {
            let mut histo = std::collections::BinaryHeap::new();
            let mut train_count = HashMap::new();

            for segment in &segments_trains {
                for train in *segment {
                    *train_count.entry(train).or_insert(0) += 1;
                }
            }

            for (train, count) in train_count {
                histo.push((count, train));
            }

            let (_, longest_train) = histo.pop().expect("Heap should not be empty");
            longest_train
        };

        segments_trains.retain(|segment| !segment.contains(longest_train));
        trains.insert(*longest_train);
    }
    trains
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use chrono::Duration;
    use common::geometry::GeoJsonLineString;
    use common::geometry::GeoJsonLineStringValue;
    use common::geometry::GeoJsonPointValue;
    use core_client::mocking::MockingClient;
    use core_client::path_properties::PropertyElectrificationValue;
    use core_client::path_properties::PropertyElectrificationValues;
    use core_client::path_properties::PropertyValuesF64;
    use core_client::path_properties::PropertyZoneValues;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrainPath;
    use pretty_assertions::assert_eq;
    use reqwest::StatusCode;
    use rstest::rstest;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::Distribution;
    use schemas::train_schedule::Margins;
    use schemas::train_schedule::PathItem;
    use schemas::train_schedule::ScheduleItem;
    use schemas::train_schedule::TrainScheduleOptions;
    use uuid::Uuid;

    use crate::models::TrainSchedule;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;

    use super::*;

    #[test]
    fn test_squash_waypoints() {
        let waypoints = Vec::new();
        assert_eq!(squash_successive_waypoints(waypoints), Vec::new());

        let waypoints = vec![
            Waypoint {
                id: "a".into(),
                stop: false,
            },
            Waypoint {
                id: "b".into(),
                stop: false,
            },
        ];
        assert_eq!(squash_successive_waypoints(waypoints.clone()), waypoints);

        let waypoints = vec![
            Waypoint {
                id: "a".into(),
                stop: false,
            },
            Waypoint {
                id: "a".into(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                id: "a".into(),
                stop: false,
            }]
        );

        let waypoints = vec![
            Waypoint {
                id: "a".into(),
                stop: false,
            },
            Waypoint {
                id: "a".into(),
                stop: true,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                id: "a".into(),
                stop: true,
            }]
        );

        let waypoints = vec![
            Waypoint {
                id: "a".into(),
                stop: false,
            },
            Waypoint {
                id: "a".into(),
                stop: false,
            },
            Waypoint {
                id: "b".into(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![
                Waypoint {
                    id: "a".into(),
                    stop: false,
                },
                Waypoint {
                    id: "b".into(),
                    stop: false,
                },
            ]
        );
    }

    #[test]
    fn decide_best_train_combination_mutually_disjoint() {
        let segments_trains = [HashSet::from([1]), HashSet::from([2]), HashSet::from([3])];
        let segments_trains = segments_trains.iter().collect::<Vec<_>>();
        let result = decide_best_train_combination(segments_trains);
        assert_eq!(result, HashSet::from([1, 2, 3]));
    }

    #[test]
    fn decide_best_train_combination_single_common_element() {
        let (frequent_train, train1, train2) = (0..).tuples().next().unwrap();
        let segments_trains = [
            HashSet::from([frequent_train, train1]),
            HashSet::from([frequent_train, train2]),
            HashSet::from([frequent_train, train1]),
        ];
        let segments_trains = segments_trains.iter().collect::<Vec<_>>();
        let result = decide_best_train_combination(segments_trains);
        assert_eq!(result, HashSet::from([frequent_train]));
    }

    #[test]
    fn decide_best_train_combination_partial_overlap() {
        let (frequent_train, less_common, thomas, train1, train2, train3, train4, train5, train6) =
            (0..).tuples().next().unwrap();
        let segments_trains = [
            HashSet::from([frequent_train, train1]),
            HashSet::from([frequent_train, train2]),
            HashSet::from([frequent_train, train3]),
            HashSet::from([frequent_train, train4]),
            HashSet::from([frequent_train, less_common]),
            HashSet::from([less_common, train5]),
            HashSet::from([less_common, train6]),
            HashSet::from([thomas]),
        ];
        let segments_trains = segments_trains.iter().collect::<Vec<_>>();
        let result = decide_best_train_combination(segments_trains);
        assert_eq!(result, HashSet::from([frequent_train, less_common, thomas]));
    }

    // The `/pathfinding/blocks` endpoint doesn't need a correct response.
    // For tests, `/path_properties` must have a correct response.
    // Since `similar_trains` calls `/pathfinding/blocks`, we need to mock this endpoint too.
    fn pathfinding_result_success() -> PathfindingResultSuccess {
        PathfindingResultSuccess {
            path: TrainPath {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![],
            },
            length: 1,
            path_item_positions: vec![0, 10],
        }
    }

    fn create_path_properties_response(
        operational_points: Vec<OperationalPointOnPath>,
    ) -> core_client::path_properties::PathPropertiesResponse {
        core_client::path_properties::PathPropertiesResponse {
            slopes: PropertyValuesF64::new(vec![0, 1], vec![0.0]),
            curves: PropertyValuesF64::new(vec![0, 1], vec![0.0]),
            electrifications: PropertyElectrificationValues::new(
                vec![0, 1],
                vec![PropertyElectrificationValue::NonElectrified],
            ),
            geometry: GeoJsonLineString::LineString(GeoJsonLineStringValue(vec![
                GeoJsonPointValue(vec![0.0, 0.0]),
            ])),
            operational_points,
            zones: PropertyZoneValues::new(vec![0, 1], vec!["Zone 1".into()]),
        }
    }

    #[allow(clippy::too_many_arguments)]
    async fn create_train_schedule(
        conn: &mut DbConnection,
        timetable_id: i64,
        rolling_stock_name: String,
        path: Vec<PathItem>,
        start_time: DateTime<Utc>,
        schedule: Vec<ScheduleItem>,
        speed_limit_tag: Option<String>,
    ) -> String {
        TrainSchedule::changeset()
            .timetable_id(timetable_id)
            .train_name(Uuid::new_v4().to_string())
            .rolling_stock_name(rolling_stock_name)
            .path(path)
            .labels(Vec::new())
            .start_time(start_time)
            .schedule(schedule)
            .margins(Margins::default())
            .initial_speed(27.8)
            .comfort(Comfort::Standard)
            .constraint_distribution(Distribution::Mareco)
            .power_restrictions(Vec::new())
            .options(TrainScheduleOptions {
                use_electrical_profiles: true,
                use_speed_limits_for_simulation: true,
            })
            .speed_limit_tag(speed_limit_tag)
            .create(conn)
            .await
            .expect("Failed to create train schedule")
            .train_name
    }

    struct InitTestResponse {
        app: TestApp,
        infra_id: i64,
        rolling_stock_names: Vec<String>,
        timetable_id: i64,
        train_name: String,
        start_time: DateTime<Utc>,
    }
    async fn init_test(path: Vec<PathItem>) -> InitTestResponse {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        let operational_points = vec![
            OperationalPointOnPath::new_test("West_station", 22, "WS"),
            OperationalPointOnPath::new_test("Mid_West_station", 33, "MWS"),
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
            OperationalPointOnPath::new_test("North_station", 55, "NES"),
            OperationalPointOnPath::new_test("South_station", 66, "SS"),
        ];
        core.stub("/path_properties")
            .response(StatusCode::OK)
            .json(create_path_properties_response(operational_points))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let rolling_stock_2 =
            create_fast_rolling_stock(&mut app.db_pool().get_ok(), &Uuid::new_v4().to_string())
                .await;

        let schedule: Vec<ScheduleItem> = vec![
            ScheduleItem::new_with_stop(
                "Mid_West_station",
                Duration::new(300, 0).expect("Failed to parse duration"),
            ),
            ScheduleItem::new_with_stop(
                "North_station",
                Duration::new(300, 0).expect("Failed to parse duration"),
            ),
            ScheduleItem::new_with_stop(
                "South_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            ),
        ];
        let start_time =
            DateTime::from_str("2025-01-01T10:00:00Z").expect("Failed to parse datetime");

        // WS(22):stop  MWS(33):stop  MES(44):passing_by  NS(55):stop  SS(66):stop
        let train_name = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock.name.clone(),
            path,
            start_time,
            schedule,
            Some("MA100".to_string()),
        )
        .await;
        InitTestResponse {
            app,
            infra_id: small_infra.id,
            rolling_stock_names: vec![rolling_stock.name, rolling_stock_2.name],
            timetable_id: timetable.id,
            train_name,
            start_time,
        }
    }

    #[rstest]
    // MWS(33):stop  MES(44):passing_by  NS(55):stop
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
        vec![
            PathItem::new_operational_point("Mid_West_station"), // MWS
            PathItem::new_operational_point("North_station"), // NS
        ],
        vec![
            Waypoint { id:"Mid_West_station".into(), stop:true },
            Waypoint { id:"Mid_East_station".into(), stop:false },
            Waypoint { id:"North_station".into(), stop:true },
        ],
        "Mid_West_station",
        "North_station",
    )]
    // NS(55):stop SS(66):stop
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
        vec![
            PathItem::new_operational_point("North_station"), // NS
            PathItem::new_operational_point("South_station"), // SS
        ],
        vec![
            Waypoint { id:"North_station".into(), stop:true },
            Waypoint { id:"South_station".into(), stop:true },
        ],
        "North_station",
        "South_station",
    )]
    async fn one_similar_train(
        #[case] path: Vec<PathItem>,
        #[case] waypoints: Vec<Waypoint>,
        #[case] begin: &str,
        #[case] end: &str,
    ) {
        let InitTestResponse {
            app,
            infra_id,
            rolling_stock_names,
            timetable_id,
            train_name,
            start_time,
        } = init_test(path).await;

        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock_names[0].clone()),
                speed_limit_tag: None,
            },
            waypoints,
            infra_id,
            timetable_id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let expected_response = Response {
            similar_trains: vec![SimilarTrainItem {
                train: Some(TrainInfo {
                    train_name,
                    start_time,
                }),
                begin: begin.into(),
                end: end.into(),
            }],
        };
        assert_eq!(response, expected_response);
    }

    #[rstest]
    // Different rolling stock
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
        1,
        Some("MA100".to_string()),
        vec![
            Waypoint { id:"Mid_West_station".into(), stop:true },
            Waypoint { id:"North_station".into(), stop:true },
        ],
        vec![
            SimilarTrainItem {
                train: None,
                begin: "Mid_West_station".into(),
                end: "North_station".into(),
            },
        ],
    )]
    // Different speed limit tag
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
        0,
        Some("MA90".to_string()),
        vec![
            Waypoint { id:"Mid_West_station".into(), stop:true },
            Waypoint { id:"North_station".into(), stop:true },
        ],
        vec![
            SimilarTrainItem {
                train: None,
                begin: "Mid_West_station".into(),
                end: "North_station".into(),
            },
        ],
    )]
    // Different schedule
    // MWS(33):stop  MES(44):stop  NS(55):stop
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
        0,
        Some("MA100".to_string()),
        vec![
            Waypoint { id:"Mid_West_station".into(), stop:true },
            Waypoint { id:"Mid_East_station".into(), stop:true },
            Waypoint { id:"North_station".into(), stop:true },
        ],
        vec![
            SimilarTrainItem {
                train: None,
                begin: "Mid_West_station".into(),
                end: "North_station".into(),
            },
        ],
    )]
    // Same schedule but too much stops
    // MWS(33):stop  MES(44):passing_by  NS(55):passing_by  SS(66):stop
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
        0,
        Some("MA100".to_string()),
        vec![
            Waypoint { id:"Mid_West_station".into(), stop:true },
            Waypoint { id:"Mid_East_station".into(), stop:false },
            Waypoint { id:"North_station".into(), stop:false },
            Waypoint { id:"South_station".into(), stop:true },
        ],
        vec![
            SimilarTrainItem {
                train: None,
                begin: "Mid_West_station".into(),
                end: "South_station".into(),
            },
        ],
    )]
    async fn no_similar_train(
        #[case] index_rolling_stock_name: usize,
        #[case] speed_limit_tag: Option<String>,
        #[case] waypoints: Vec<Waypoint>,
        #[case] similar_trains: Vec<SimilarTrainItem>,
    ) {
        let path = vec![
            PathItem::new_operational_point("West_station"), // WS
            PathItem::new_operational_point("Mid_West_station"), // MWS
            PathItem::new_operational_point("Mid_East_station"), // MES
            PathItem::new_operational_point("North_station"), // NS
            PathItem::new_operational_point("South_station"), // SS
        ];
        let InitTestResponse {
            app,
            infra_id,
            rolling_stock_names,
            timetable_id,
            ..
        } = init_test(path).await;

        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock_names[index_rolling_stock_name].clone()),
                speed_limit_tag,
            },
            waypoints,
            infra_id,
            timetable_id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response, Response { similar_trains });
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn compound_similar_trains() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        let operational_points_for_train_1 = vec![
            OperationalPointOnPath::new_test("West_station", 22, "WS"),
            OperationalPointOnPath::new_test("Mid_West_station", 33, "MWS"),
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
        ];
        let operational_points_for_train_2 = vec![
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
            OperationalPointOnPath::new_test("North_station", 55, "NES"),
            OperationalPointOnPath::new_test("South_station", 66, "SS"),
        ];
        core.stub("/path_properties")
            .response(StatusCode::OK)
            .json(create_path_properties_response(
                operational_points_for_train_1,
            ))
            .json(create_path_properties_response(
                operational_points_for_train_2,
            ))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let path: Vec<PathItem> = vec![
            PathItem::new_operational_point("West_station"), // WS
            PathItem::new_operational_point("Mid_East_station"), // MES
        ];
        let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
            "West_station",
            Duration::new(0, 0).expect("Failed to parse duration"),
        )];
        let start_time_1 =
            DateTime::from_str("2025-01-01T10:00:00Z").expect("Failed to parse datetime");

        // WS(22):stop  MWS(33):passing_by  MES(44):stop
        let train_1 = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock.name.clone(),
            path,
            start_time_1,
            schedule,
            Some("MA100".to_string()),
        )
        .await;

        let path: Vec<PathItem> = vec![
            PathItem::new_operational_point("Mid_East_station"), // MES
            PathItem::new_operational_point("South_station"),    // SS
        ];
        let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
            "Mid_East_station",
            Duration::new(0, 0).expect("Failed to parse duration"),
        )];
        let start_time_2 =
            DateTime::from_str("2025-01-01T12:00:00Z").expect("Failed to parse datetime");

        // MES(44):stop  NS(55):passing_by  SS(66):stop
        let train_2 = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock.name.clone(),
            path,
            start_time_2,
            schedule,
            Some("MA100".to_string()),
        )
        .await;

        // WS(22):stop  MWS(33):passing_by  MES(44):stop NS(55):passing_by  SS(66):stop
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock.name),
                speed_limit_tag: Some("MA100".to_string()),
            },
            waypoints: vec![
                Waypoint {
                    id: "West_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "Mid_West_station".into(),
                    stop: false,
                },
                Waypoint {
                    id: "Mid_East_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "North_station".into(),
                    stop: false,
                },
                Waypoint {
                    id: "South_station".into(),
                    stop: true,
                },
            ],
            infra_id: small_infra.id,
            timetable_id: timetable.id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let expected_response = Response {
            similar_trains: vec![
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_1,
                        start_time: start_time_1,
                    }),
                    begin: "West_station".into(),
                    end: "Mid_East_station".into(),
                },
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_2,
                        start_time: start_time_2,
                    }),
                    begin: "Mid_East_station".into(),
                    end: "South_station".into(),
                },
            ],
        };
        assert_eq!(response, expected_response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_select_single_train_without_merging_consecutive_segments() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        let operational_points_ws_nes = vec![
            OperationalPointOnPath::new_test("West_station", 22, "WS"),
            OperationalPointOnPath::new_test("Mid_West_station", 33, "MWS"),
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
            OperationalPointOnPath::new_test("North_East_station", 77, "NES"),
        ];
        let operational_points_ws_mes = vec![
            OperationalPointOnPath::new_test("West_station", 22, "WS"),
            OperationalPointOnPath::new_test("Mid_West_station", 33, "MWS"),
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
        ];
        let operational_points_mes_nes = vec![
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
            OperationalPointOnPath::new_test("North_East_station", 77, "NES"),
        ];
        core.stub("/path_properties")
            .response(StatusCode::OK)
            .json(create_path_properties_response(
                operational_points_ws_mes.clone(),
            )) // train_1
            .json(create_path_properties_response(operational_points_ws_mes)) // train_2
            .json(create_path_properties_response(
                operational_points_mes_nes.clone(),
            )) // train_3
            .json(create_path_properties_response(operational_points_mes_nes)) // train_4
            .json(create_path_properties_response(operational_points_ws_nes)) // train_5
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let mut hour = 10;
        for _ in 1..3 {
            let path: Vec<PathItem> = vec![
                PathItem::new_operational_point("West_station"), // WS
                PathItem::new_operational_point("Mid_West_station"), // MWS
                PathItem::new_operational_point("Mid_East_station"), // MES
            ];
            let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )];
            let start_time = DateTime::from_str(format!("2025-01-01T{hour}:00:00Z").as_str())
                .expect("Failed to parse datetime");
            hour += 1;

            // WS(22):stop  MWS(33):passing_by  MES(44):stop
            let _ = create_train_schedule(
                &mut db_pool.get_ok(),
                timetable.id,
                rolling_stock.name.clone(),
                path,
                start_time,
                schedule,
                Some("MA100".to_string()),
            )
            .await;
        }

        for _ in 3..5 {
            let path: Vec<PathItem> = vec![
                PathItem::new_operational_point("Mid_East_station"), // MES
                PathItem::new_operational_point("North_East_station"), // NES
            ];
            let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
                "North_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            )];
            let start_time = DateTime::from_str(format!("2025-01-01T{hour}:00:00Z").as_str())
                .expect("Failed to parse datetime");
            hour += 1;

            // MES(44):stop  NES(77):stop
            let _ = create_train_schedule(
                &mut db_pool.get_ok(),
                timetable.id,
                rolling_stock.name.clone(),
                path,
                start_time,
                schedule,
                Some("MA100".to_string()),
            )
            .await;
        }

        let path: Vec<PathItem> = vec![
            PathItem::new_operational_point("West_station"), // WS
            PathItem::new_operational_point("Mid_East_station"), // MES
            PathItem::new_operational_point("North_East_station"), // NES
        ];
        let schedule: Vec<ScheduleItem> = vec![
            ScheduleItem::new_with_stop(
                "Mid_East_station",
                Duration::new(300, 0).expect("Failed to parse duration"),
            ),
            ScheduleItem::new_with_stop(
                "North_East_station",
                Duration::new(0, 0).expect("Failed to parse duration"),
            ),
        ];
        let start_time = DateTime::from_str(format!("2025-01-01T{hour}:00:00Z").as_str())
            .expect("Failed to parse datetime");

        // WS(22):stop  MWS(33):passing_by  MES(44):stop  NES(77):stop
        let train_name = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock.name.clone(),
            path,
            start_time,
            schedule,
            Some("MA100".to_string()),
        )
        .await;

        // WS(22):stop  MWS(33):passing_by  MES(44):stop  NES(77):stop
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock.name),
                speed_limit_tag: Some("MA100".to_string()),
            },
            waypoints: vec![
                Waypoint {
                    id: "West_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "Mid_West_station".into(),
                    stop: false,
                },
                Waypoint {
                    id: "Mid_East_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "North_East_station".into(),
                    stop: true,
                },
            ],
            infra_id: small_infra.id,
            timetable_id: timetable.id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let expected_response = Response {
            similar_trains: vec![
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_name.clone(),
                        start_time,
                    }),
                    begin: "West_station".into(),
                    end: "Mid_East_station".into(),
                },
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name,
                        start_time,
                    }),
                    begin: "Mid_East_station".into(),
                    end: "North_East_station".into(),
                },
            ],
        };
        assert_eq!(response, expected_response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn no_similar_trains_for_some_segments() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        let operational_points_ws_mws = vec![
            OperationalPointOnPath::new_test("West_station", 22, "WS"),
            OperationalPointOnPath::new_test("Mid_West_station", 33, "MWS"),
        ];
        let operational_points_mes_ns = vec![
            OperationalPointOnPath::new_test("Mid_East_station", 44, "MES"),
            OperationalPointOnPath::new_test("North_station", 55, "NS"),
        ];
        core.stub("/path_properties")
            .response(StatusCode::OK)
            .json(create_path_properties_response(operational_points_ws_mws)) // train_1
            .json(create_path_properties_response(operational_points_mes_ns)) // train_2
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let path: Vec<PathItem> = vec![
            PathItem::new_operational_point("West_station"), // WS
            PathItem::new_operational_point("Mid_West_station"), // MWS
        ];
        let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
            "Mid_West_station",
            Duration::new(0, 0).expect("Failed to parse duration"),
        )];
        let start_time_1 =
            DateTime::from_str("2025-01-01T10:00:00Z").expect("Failed to parse datetime");

        // WS(22):stop  MWS(33):stop
        let train_1 = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock.name.clone(),
            path,
            start_time_1,
            schedule,
            Some("MA100".to_string()),
        )
        .await;

        let path: Vec<PathItem> = vec![
            PathItem::new_operational_point("Mid_East_station"), // MES
            PathItem::new_operational_point("North_station"),    // NS
        ];
        let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
            "North_station",
            Duration::new(0, 0).expect("Failed to parse duration"),
        )];
        let start_time_2 =
            DateTime::from_str("2025-01-01T11:00:00Z").expect("Failed to parse datetime");

        // MES(44):stop  NS(55):stop
        let train_2 = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock.name.clone(),
            path,
            start_time_2,
            schedule,
            Some("MA100".to_string()),
        )
        .await;

        // WS(22):stop  MWS(33):stop  MES(44):stop  NS(55):stop  SS(66):stop
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock.name),
                speed_limit_tag: Some("MA100".to_string()),
            },
            waypoints: vec![
                Waypoint {
                    id: "West_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "Mid_West_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "Mid_East_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "North_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "South_station".into(),
                    stop: true,
                },
            ],
            infra_id: small_infra.id,
            timetable_id: timetable.id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let expected_response = Response {
            similar_trains: vec![
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_1,
                        start_time: start_time_1,
                    }),
                    begin: "West_station".into(),
                    end: "Mid_West_station".into(),
                },
                SimilarTrainItem {
                    train: None,
                    begin: "Mid_West_station".into(),
                    end: "Mid_East_station".into(),
                },
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_2,
                        start_time: start_time_2,
                    }),
                    begin: "Mid_East_station".into(),
                    end: "North_station".into(),
                },
                SimilarTrainItem {
                    train: None,
                    begin: "North_station".into(),
                    end: "South_station".into(),
                },
            ],
        };
        assert_eq!(response, expected_response);
    }

    #[test]
    fn test_rolling_stock_characteristics_deserialize_with_name_only() {
        let json = r#"{"name": "rolling_stock_name"}"#;
        let result = serde_json::from_str::<RollingStockCharacteristics>(json);
        assert_eq!(
            result.unwrap(),
            RollingStockCharacteristics {
                name: Some("rolling_stock_name".to_string()),
                speed_limit_tag: None
            }
        );
    }

    #[test]
    fn test_rolling_stock_characteristics_deserialize_with_speed_limit_tag_only() {
        let json = r#"{"speed_limit_tag": "MA100"}"#;
        let result = serde_json::from_str::<RollingStockCharacteristics>(json);
        assert_eq!(
            result.unwrap(),
            RollingStockCharacteristics {
                name: None,
                speed_limit_tag: Some("MA100".to_string())
            }
        );
    }

    #[test]
    fn test_rolling_stock_characteristics_deserialize_with_both_fields() {
        let json = r#"{"name": "rolling_stock_name", "speed_limit_tag": "MA100"}"#;
        let result = serde_json::from_str::<RollingStockCharacteristics>(json);
        assert_eq!(
            result.unwrap(),
            RollingStockCharacteristics {
                name: Some("rolling_stock_name".to_string()),
                speed_limit_tag: Some("MA100".to_string())
            }
        );
    }

    #[test]
    fn test_rolling_stock_characteristics_deserialize_missing_both_fields() {
        let json = r#"{}"#;
        let result = serde_json::from_str::<RollingStockCharacteristics>(json);
        let error = result.unwrap_err();
        assert!(error.to_string().contains(
            "Both 'name' and 'speed_limit_tag' are missing; at least one must be provided."
        ));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_similar_trains_by_relaxing_name_criterion() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        let operational_points_ws_mws = vec![
            OperationalPointOnPath::new_test("West_station", 22, "WS"),
            OperationalPointOnPath::new_test("Mid_West_station", 33, "MWS"),
        ];
        core.stub("/path_properties")
            .response(StatusCode::OK)
            .json(create_path_properties_response(operational_points_ws_mws)) // train_1
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock_1 =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let rolling_stock_2 =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let path: Vec<PathItem> = vec![
            PathItem::new_operational_point("West_station"), // WS
            PathItem::new_operational_point("Mid_West_station"), // MWS
        ];
        let schedule: Vec<ScheduleItem> = vec![ScheduleItem::new_with_stop(
            "Mid_West_station",
            Duration::new(0, 0).expect("Failed to parse duration"),
        )];
        let start_time =
            DateTime::from_str("2025-01-01T10:00:00Z").expect("Failed to parse datetime");

        // WS(22):stop  MWS(33):stop
        let train_name = create_train_schedule(
            &mut db_pool.get_ok(),
            timetable.id,
            rolling_stock_2.name,
            path,
            start_time,
            schedule,
            Some("MA100".to_string()),
        )
        .await;

        // WS(22):stop  MWS(33):stop
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock_1.name),
                speed_limit_tag: Some("MA100".to_string()),
            },
            waypoints: vec![
                Waypoint {
                    id: "West_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "Mid_West_station".into(),
                    stop: true,
                },
            ],
            infra_id: small_infra.id,
            timetable_id: timetable.id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let expected_response = Response {
            similar_trains: vec![SimilarTrainItem {
                train: None,
                begin: "West_station".into(),
                end: "Mid_West_station".into(),
            }],
        };
        assert_eq!(response, expected_response);

        // WS(22):stop  MWS(33):stop
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: None,
                speed_limit_tag: Some("MA100".to_string()),
            },
            waypoints: vec![
                Waypoint {
                    id: "West_station".into(),
                    stop: true,
                },
                Waypoint {
                    id: "Mid_West_station".into(),
                    stop: true,
                },
            ],
            infra_id: small_infra.id,
            timetable_id: timetable.id,
        };
        let request = app.post("/similar_trains").json(&request);
        let response: Response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let expected_response = Response {
            similar_trains: vec![SimilarTrainItem {
                train: Some(TrainInfo {
                    train_name,
                    start_time,
                }),
                begin: "West_station".into(),
                end: "Mid_West_station".into(),
            }],
        };
        assert_eq!(response, expected_response);
    }
}
