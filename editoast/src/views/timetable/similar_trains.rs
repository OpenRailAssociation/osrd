mod graph;
mod new_train;
mod past_train;

use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use axum::Extension;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Utc;
use core_client::CoreClient;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_schemas::infra::OperationalPointSncfExtension;
use itertools::Itertools as _;
use serde::Deserialize;
use serde::Serialize;
use smol_str::SmolStr;
use smol_str::ToSmolStr as _;
use utoipa::ToSchema;

use crate::ValkeyClient;
use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::models;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::prelude::*;
use crate::models::timetable::Timetable;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding_from_train_batch;
use crate::views::timetable::similar_trains::graph::AdvancementError;
use crate::views::timetable::similar_trains::graph::AdvancementErrorKind;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

// Simulation layer struct, not a view struct, to move in some mod.rs when the simulation crate will be there
// TODO: use operational point IDs (not obj_ids)
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct Codes {
    primary: u64,
    secondary: SmolStr,
}

impl Codes {
    pub fn new(primary: u64, secondary: SmolStr) -> Self {
        Self { primary, secondary }
    }
}

impl<'a> From<&'a OperationalPointSncfExtension> for Codes {
    fn from(
        OperationalPointSncfExtension { ci, ch, .. }: &'a OperationalPointSncfExtension,
    ) -> Self {
        Self::new(*ci as u64, ch.to_smolstr())
    }
}

impl std::fmt::Display for Codes {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.primary, self.secondary)
    }
}

editoast_common::schemas! {
    Waypoint,
    WaypointResponse,
}

crate::routes! {
    "/similar_trains" => similar_trains,
}

#[derive(Debug, Deserialize, ToSchema)]
struct RollingStockCharacteristics {
    name: String,
    speed_limit_tag: Option<String>,
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarTrainWaypoint)]
struct Waypoint {
    ci: u64,
    #[schema(value_type = String)]
    ch: SmolStr,
    stop: bool,
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}:{}{}",
            self.ci,
            self.ch,
            if self.stop { "[STOP]" } else { "" },
        )
    }
}

#[derive(Debug, Deserialize, ToSchema)]
struct Request {
    #[schema(inline)]
    rolling_stock: RollingStockCharacteristics,
    #[schema(value_type = Vec<SimilarTrainWaypoint>)]
    waypoints: Vec<Waypoint>,
    infra_id: i64,
    timetable_id: i64,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarTrainWaypointResponse)]
struct WaypointResponse {
    ci: i64,
    #[schema(value_type = String)]
    ch: SmolStr,
}

#[derive(Debug, Serialize, ToSchema)]
struct SimilarTrainItem {
    #[schema(value_type = String)]
    train_name: past_train::Name,
    start_time: DateTime<Utc>,
    #[schema(value_type = SimilarTrainWaypointResponse)]
    begin: WaypointResponse,
    #[schema(value_type = SimilarTrainWaypointResponse)]
    end: WaypointResponse,
}

#[derive(Debug, Serialize, ToSchema)]
struct Response {
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
    Database(editoast_models::model::Error),
}

#[utoipa::path(
    post, path = "",
    tag = "similar_trains,stdcm,sncf",
    request_body = inline(Request),
    responses(
        (
            status = 200,
            description = "A combination of reference train identifiers similar to the provided train",
            body = inline(Response),
        ),
    ),
)]
async fn similar_trains(
    Extension(auth): AuthenticationExt,
    State(AppState {
        db_pool,
        speed_limit_tag_ids,
        valkey,
        core_client,
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
            .authorize_infra_read(&editoast_authz::Infra(infra_id))
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

    let infra = Infra::retrieve_real_or_fail(conn.clone(), infra_id, || {
        SimilarTrainsError::InfraNotFound { infra_id }
    })
    .await?;

    let waypoints = squash_successive_waypoints(waypoints);
    let wp_count = waypoints.len();
    let new_train_waypoints = waypoints.into_iter().map(|Waypoint { ci, ch, stop }| {
        if stop {
            new_train::Waypoint::stop(ci, ch)
        } else {
            new_train::Waypoint::passing_by(ci, ch)
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
            similar_trains: Vec::new(),
        }));
    }

    // keep the departure date in memory in order to build the API response later on
    let candidate_schedules_departure_date = candidate_schedules
        .iter()
        .map(|ts| (ts.train_name.to_smolstr(), ts.start_time))
        .collect::<HashMap<_, _>>();

    // Step 3 : simulate candidate train schedules
    // -------------------------------------------

    let selected_past_trains = simulate_past_trains(
        &mut conn,
        valkey,
        core_client,
        &infra,
        &new_train,
        candidate_schedules,
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
            graph.push(past_train.name(), waypoints.iter().cloned());
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
        let mut state = graph::MatchingState::new(segment, graph);
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
                    // TODO: also collect trains with no similar trains found — for front display
                    break;
                }
            }
        }
    }

    // Step 6: determine which similar train to choose for each segment
    // ----------------------------------------------------------------

    let similar_trains =
        decide_best_train_combination(trains.iter().map(|(_, trains)| trains).cloned().collect());

    // Final step: build the API response
    // ----------------------------------

    // Compresses successive segments with the same retained train name
    let similar_trains = trains
        .into_iter()
        .map(|(seg, trains)| {
            (
                seg,
                trains.intersection(&similar_trains).next().unwrap().clone(),
            )
        })
        .fold(Vec::new(), |mut trains, ((begin, end), train_name)| {
            if let Some(((_, prev_end), prev_train)) = trains.last_mut() {
                if *prev_train == train_name {
                    *prev_end = end;
                }
            } else {
                trains.push(((begin, end), train_name));
            }
            trains
        });

    let response_items = similar_trains
        .into_iter()
        .map(|((begin, end), train_name)| SimilarTrainItem {
            start_time: *candidate_schedules_departure_date
                .get(&train_name)
                .expect("retained similar trains are in the candidate schedules pool"),
            train_name,
            begin: WaypointResponse {
                ci: begin.codes.primary as i64,
                ch: begin.codes.secondary,
            },
            end: WaypointResponse {
                ci: end.codes.primary as i64,
                ch: end.codes.secondary,
            },
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
    if !RollingStock::exists(conn, name.clone()).await? {
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
        if let Some(prev) = result.last_mut() {
            if prev.ci == waypoint.ci && prev.ch == waypoint.ch {
                prev.stop |= waypoint.stop;
                continue;
            }
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
        .filter(move || models::TrainSchedule::ROLLING_STOCK_NAME.eq(rolling_stock_name.clone()));
    let train_schedules = models::TrainSchedule::list(
        conn,
        if let Some(speed) = speed_limit_tag {
            filter.filter(move || models::TrainSchedule::SPEED_LIMIT_TAG.eq(Some(speed.clone())))
        } else {
            filter
        },
    )
    .await?;

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
        .map(|(stop1, stop2)| (stop1.codes.clone(), stop2.codes.clone()))
        .collect::<HashSet<_>>();

    let candidate_schedules  =
        tracing::debug_span!("keeping train schedules stopping at segment ends").in_scope(|| {
            let mut candidates: Vec<models::TrainSchedule> = Default::default();
            for train_schedule in train_schedules {
                let retain_schedule = {
                    let mut stop_pairs_forming_a_segment = train_schedule.iter_stops()
                        .flat_map(|p| path_item_cache.get_from_path_location(&p.location))
                        .tuple_windows()
                        .flat_map(|(ops1, ops2)| ops1.iter().cartesian_product(ops2.iter()))
                        .filter_map(|(op1, op2)| {
                            if let (Some(sncf1), Some(sncf2)) = (op1.extensions.sncf.as_ref(), op2.extensions.sncf.as_ref()) {
                                Some((Codes::from(sncf1), Codes::from(sncf2)))
                            } else {
                                tracing::warn!(
                                    ?op1,
                                    ?op2,
                                    train_schedule_id = train_schedule.id,
                                    "operational point pair is missing an SNCF extension, required for similar schedules, ignoring it"
                                );
                                None
                            }
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
    valkey: Arc<ValkeyClient>,
    core_client: Arc<CoreClient>,
    infra: &Infra,
    new_train: &new_train::NewTrain,
    candidate_schedules: Vec<models::TrainSchedule>,
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
    .map(editoast_schemas::RollingStock::from)
    .collect_vec();

    let paths = {
        let paths = pathfinding_from_train_batch(
            conn,
            &mut valkey.get_connection().await?,
            core_client.clone(),
            infra,
            &candidate_schedules,
            &rolling_stocks,
        )
        .await?;
        paths
            .into_iter()
            .zip(candidate_schedules.iter())
            .filter_map(
                |(path, ts)| match Arc::try_unwrap(path).expect("only one reference") {
                    PathfindingResult::Success(path) => Some(path),
                    PathfindingResult::Failure(failure) => {
                        tracing::warn!(
                            ?failure,
                            train_schedule = ts.train_name,
                            train_schedule_id = ts.id,
                            "failed to compute path for train schedule, skipping it",
                        );
                        None
                    }
                },
            )
            .collect_vec()
    };

    let path_properties_requests = paths
        .iter()
        .map(|path| PathPropertiesRequest {
            track_section_ranges: &path.track_section_ranges,
            infra: infra.id,
            expected_version: infra.version,
        })
        .collect::<Vec<_>>();

    let mut valkey_conn = valkey.get_connection().await?;
    let path_properties = crate::views::path::properties::compute_path_properties_batch(
        core_client,
        &mut valkey_conn,
        &path_properties_requests,
    )
    .await?;

    let stop_waypoints = new_train
        .stops()
        .map(|wp| wp.codes.clone())
        .collect::<HashSet<_>>();
    let selected_past_trains = path_properties
        .zip(candidate_schedules.into_iter())
        .map(
            |(
                core_client::path_properties::PathPropertiesResponse {
                    operational_points, ..
                },
                ts,
            )| {
                let ops = operational_points.into_iter().filter_map(
                    |OperationalPointOnPath { extensions, .. }| {
                        let sncf = extensions.sncf.as_ref()?;
                        let codes = Codes::from(sncf);
                        Some(graph::Waypoint {
                            stop: stop_waypoints.contains(&codes),
                            codes,
                        })
                    },
                );
                past_train::PastTrain::new(ts.train_name.to_smolstr(), ops)
            },
        )
        .collect_vec();

    Ok(selected_past_trains)
}

// TODO: minimize the number of trains to duplicate or minimize the disjoint segments in the simulation sheet?
#[tracing::instrument(ret(level = "debug"))]
fn decide_best_train_combination(
    mut segments_trains: Vec<HashSet<past_train::Name>>,
) -> HashSet<past_train::Name> {
    let mut trains = HashSet::default();

    while !segments_trains.is_empty() {
        let longest_train = {
            let mut histo = std::collections::BinaryHeap::new();
            let mut train_count = HashMap::new();

            for segment in &segments_trains {
                for train in segment {
                    *train_count.entry(train).or_insert(0) += 1;
                }
            }

            for (train, count) in train_count {
                histo.push((count, train));
            }

            let (_, longest_train) = histo.pop().expect("Heap should not be empty");
            longest_train.clone()
        };
        segments_trains.retain(|segment| !segment.contains(&longest_train));
        trains.insert(longest_train);
    }

    trains
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;
    use smol_str::ToSmolStr;

    #[test]
    fn test_squash_waypoints() {
        let waypoints = Vec::new();
        assert_eq!(squash_successive_waypoints(waypoints), Vec::new());

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_smolstr(),
                stop: false,
            },
        ];
        assert_eq!(squash_successive_waypoints(waypoints.clone()), waypoints);

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            }]
        );

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: true,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: true,
            }]
        );

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_smolstr(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![
                Waypoint {
                    ci: 1,
                    ch: "a".to_smolstr(),
                    stop: false,
                },
                Waypoint {
                    ci: 2,
                    ch: "b".to_smolstr(),
                    stop: false,
                },
            ]
        );
    }

    #[test]
    fn decide_best_train_combination_mutually_disjoint() {
        let segments_trains = vec![
            HashSet::from(["train1".to_smolstr()]),
            HashSet::from(["train2".to_smolstr()]),
            HashSet::from(["train3".to_smolstr()]),
        ];
        let result = decide_best_train_combination(segments_trains);
        assert_eq!(
            result,
            HashSet::from([
                "train1".to_smolstr(),
                "train2".to_smolstr(),
                "train3".to_smolstr()
            ])
        );
    }

    #[test]
    fn decide_best_train_combination_single_common_element() {
        let segments_trains = vec![
            HashSet::from(["common_train".to_smolstr(), "train1".to_smolstr()]),
            HashSet::from(["common_train".to_smolstr(), "train2".to_smolstr()]),
            HashSet::from(["common_train".to_smolstr(), "train1".to_smolstr()]),
        ];
        let result = decide_best_train_combination(segments_trains);
        assert_eq!(result, HashSet::from(["common_train".to_smolstr()]));
    }

    #[test]
    fn decide_best_train_combination_partial_overlap() {
        let segments_trains = vec![
            HashSet::from(["frequent_train".to_smolstr(), "train1".to_smolstr()]),
            HashSet::from(["frequent_train".to_smolstr(), "train2".to_smolstr()]),
            HashSet::from(["frequent_train".to_smolstr(), "train3".to_smolstr()]),
            HashSet::from(["frequent_train".to_smolstr(), "train4".to_smolstr()]),
            HashSet::from(["frequent_train".to_smolstr(), "less_common".to_smolstr()]),
            HashSet::from(["less_common".to_smolstr(), "train5".to_smolstr()]),
            HashSet::from(["less_common".to_smolstr(), "train6".to_smolstr()]),
            HashSet::from(["thomas".to_smolstr()]),
        ];
        let result = decide_best_train_combination(segments_trains);
        assert_eq!(
            result,
            HashSet::from([
                "frequent_train".to_smolstr(),
                "less_common".to_smolstr(),
                "thomas".to_smolstr()
            ])
        );
    }
}
