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
pub mod trains_traffic;

use std::collections::HashMap;
use std::collections::HashSet;
use std::ops::Deref;

use arcstr::ArcStr;
use authz::Role;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Utc;
use database::DbConnection;
use derive_more::Deref;
use derive_more::Display;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::views::timetable::similar_trains::graph::AdvancementError;
use crate::views::timetable::similar_trains::graph::AdvancementErrorKind;
use crate::views::timetable::similar_trains::past_train::PastTrain;
use editoast_models::prelude::*;
use editoast_models::rolling_stock::RollingStock;

use super::AppState;

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

#[cfg_attr(test, derive(Serialize))]
#[derive(Clone, Deserialize, Hash, Eq, PartialEq, ToSchema)]
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

    #[error("Rolling stock '{rolling_stock_name}' does not exist")]
    #[editoast_error(status = 400)]
    RollingStockNotFound { rolling_stock_name: String },

    #[error("Speed limit tag '{speed_limit_tag}' does not exist")]
    #[editoast_error(status = 400)]
    SpeedLimitNotFound { speed_limit_tag: String },

    #[error("Trains traffic is empty")]
    #[editoast_error(status = 400)]
    EmptyTrainsTraffic,

    #[error("Database error")]
    #[editoast_error(status = 500)]
    #[from(forward)]
    Database(editoast_models::Error),
}

#[editoast_derive::route(Role::Stdcm)]
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
    State(AppState {
        db_pool,
        speed_limit_tag_ids,
        trains_traffic,
        ..
    }): State<AppState>,
    Json(Request {
        rolling_stock,
        waypoints,
    }): Json<Request>,
) -> Result<Json<Response>> {
    let mut conn = db_pool.get().await?;

    // Get trains traffic
    let traffic = trains_traffic.read().await;
    // If the train traffic is empty, finding a similar train is not possible
    if traffic.len() == 0 {
        return Err(SimilarTrainsError::EmptyTrainsTraffic.into());
    }

    // Step 1: input validation and preprocessing
    // ------------------------------------------
    validate_rolling_stock_input(&mut conn, &rolling_stock, &speed_limit_tag_ids).await?;

    // Step 2: create a new train instance
    // -----------------------------------
    let waypoints = squash_successive_waypoints(waypoints);
    let wp_count = waypoints.len();
    let new_train_waypoints = waypoints.clone().into_iter().map(|Waypoint { id, stop }| {
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

    let default_response = Response {
        similar_trains: vec![SimilarTrainItem {
            train: None,
            begin: new_train.begin().op.deref().clone(),
            end: new_train.end().op.deref().clone(),
        }],
    };

    // Step 3: find in the previous trains traffic, compatible trains that overlap its path
    // ------------------------------------------------------------------------------------
    let compatible_trains = traffic.find_compatible_trains(
        rolling_stock.name,
        rolling_stock.speed_limit_tag,
        waypoints.iter().map(|w| graph::Waypoint {
            op: OperationalPoint(w.id.clone()),
            stop: w.stop,
        }),
    );

    tracing::debug!(nbcompatible = compatible_trains.len(), "Compatible trains");

    // Early return if we found no compatible train
    if compatible_trains.is_empty() {
        return Ok(Json(default_response));
    }
    let pool = past_train::Pool::from_iter(compatible_trains.iter().map(|t| t.train.clone()));

    // Step 4: build candidate paths graph for each segment
    // ----------------------------------------------------
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
        #[cfg(debug_assertions)]
        std::fs::write("/tmp/dot.txt", graph.to_dot()).unwrap();

        let begin = segment.begin().clone();
        let end = segment.end().clone();

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

    // Early return if we found no train
    if trains.is_empty() {
        return Ok(Json(default_response));
    }

    // Step 6: determine which similar train to choose for each segment
    // ----------------------------------------------------------------
    tracing::debug!(trains = trains.len(), "Trains");
    tracing::debug!(
        trains = trains
            .iter()
            .map(|(_, trains)| trains)
            .filter(|trains| !trains.is_empty())
            .collect::<Vec<_>>()
            .len(),
        "Trains not empty"
    );
    let similar_trains = decide_best_train_combination(
        trains
            .iter()
            .map(|(_, trains)| trains)
            .filter(|trains| !trains.is_empty())
            .collect::<Vec<_>>(),
    );

    tracing::debug!(similar_trains = similar_trains.len(), "Similar trains");

    // Final step: build the API response
    // ----------------------------------
    let response_items = trains
        .into_iter()
        .map(|((begin, end), trains)| {
            let train_id = trains.intersection(&similar_trains).next().cloned();

            SimilarTrainItem {
                train: train_id.and_then(|train_id| {
                    traffic.get_by_id(train_id).map(|t| TrainInfo {
                        train_name: t.name,
                        start_time: t.start_time,
                    })
                }),
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

// TODO: minimize the number of trains to duplicate or minimize the disjoint segments in the simulation sheet?
#[tracing::instrument(ret(level = "debug"))]
fn decide_best_train_combination(
    mut segments_trains: Vec<&HashSet<past_train::Id>>,
) -> HashSet<past_train::Id> {
    let mut trains: HashSet<past_train::Id> = HashSet::default();

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
    use chrono::Duration;
    use itertools::Itertools;
    use pretty_assertions::assert_eq;
    use reqwest::StatusCode;
    use rstest::rstest;
    use uuid::Uuid;

    use crate::fixtures::create_fast_rolling_stock;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::similar_trains::trains_traffic::TrainTraffic;

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

    struct InitTestResponse {
        app: TestApp,
    }
    async fn init_test(trains_traffic: Vec<TrainTraffic>) -> InitTestResponse {
        let app = TestAppBuilder::new()
            .with_trains_traffic(trains_traffic.clone())
            .build();
        let db_pool = app.db_pool();

        // Create rolling stock
        let rolling_stock_names = trains_traffic
            .iter()
            .map(|train| train.rolling_stock.clone())
            .collect::<HashSet<String>>();
        for rs in rolling_stock_names.clone() {
            create_fast_rolling_stock(&mut db_pool.get_ok(), &rs).await;
        }

        InitTestResponse { app }
    }

    #[rstest]
    // MWS(33):stop  MES(44):passing_by  NS(55):stop
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(
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
            Waypoint { id:"North_station".into(), stop:true },
            Waypoint { id:"South_station".into(), stop:true },
        ],
        "North_station",
        "South_station",
    )]
    async fn one_similar_train(
        #[case] waypoints: Vec<Waypoint>,
        #[case] begin: &str,
        #[case] end: &str,
    ) {
        let train_traffic = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: Uuid::new_v4().to_string(),
            speed_limit_tag: "MA100".to_string(),
            train: PastTrain::new(
                1,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("West_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_West_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_East_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("North_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("South_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        let InitTestResponse { app } = init_test(vec![train_traffic.clone()]).await;

        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(train_traffic.rolling_stock.clone()),
                speed_limit_tag: None,
            },
            waypoints,
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
                    train_name: train_traffic.name.clone(),
                    start_time: train_traffic.start_time,
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
        false,
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
        true,
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
        true,
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
        true,
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
        #[case] use_same_rolling_stock: bool,
        #[case] speed_limit_tag: Option<String>,
        #[case] waypoints: Vec<Waypoint>,
        #[case] similar_trains: Vec<SimilarTrainItem>,
    ) {
        let train_traffic = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: Uuid::new_v4().to_string(),
            speed_limit_tag: "MA100".to_string(),
            train: PastTrain::new(
                1,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("West_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_West_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_East_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("North_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("South_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        let InitTestResponse { app } = init_test(vec![train_traffic.clone()]).await;

        let request_rolling_stock = Some(if use_same_rolling_stock {
            train_traffic.rolling_stock.clone()
        } else {
            let db_pool = app.db_pool();
            let other_rolling_stock_name = Uuid::new_v4().to_string();
            create_fast_rolling_stock(&mut db_pool.get_ok(), &other_rolling_stock_name).await;
            other_rolling_stock_name
        });
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: request_rolling_stock,
                speed_limit_tag,
            },
            waypoints,
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
        let rolling_stock_name = Uuid::new_v4().to_string();
        let speed_limit_tag = "MA100".to_string();
        let train_1 = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: rolling_stock_name.clone(),
            speed_limit_tag: speed_limit_tag.clone(),
            train: PastTrain::new(
                1,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("West_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_West_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_East_station".into()),
                        stop: true,
                    },
                ],
            ),
        };

        // MES(44):stop  NS(55):passing_by  SS(66):stop
        let train_2 = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: rolling_stock_name.clone(),
            speed_limit_tag: speed_limit_tag.clone(),
            train: PastTrain::new(
                2,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("Mid_East_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("North_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("South_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        let InitTestResponse { app } = init_test(vec![train_1.clone(), train_2.clone()]).await;

        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock_name),
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
                        train_name: train_1.name,
                        start_time: train_1.start_time,
                    }),
                    begin: "West_station".into(),
                    end: "Mid_East_station".into(),
                },
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_2.name,
                        start_time: train_2.start_time,
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
        let rolling_stock_name = Uuid::new_v4().to_string();
        let speed_limit_tag = "MA100".to_string();
        let mut traffics = Vec::<TrainTraffic>::new();

        // WS(22):stop  MWS(33):passing_by  MES(44):stop  NES(77):stop
        let train_targeted = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: rolling_stock_name.clone(),
            speed_limit_tag: speed_limit_tag.clone(),
            train: PastTrain::new(
                0,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("West_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_West_station".into()),
                        stop: false,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_East_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("North_East_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        traffics.push(train_targeted.clone());

        let mut hour = 10;
        // WS(22):stop  MWS(33):passing_by  MES(44):stop
        for index in 1..3 {
            let start_time = Utc::now() + Duration::hours(hour);
            hour += 1;
            traffics.push(TrainTraffic {
                name: Uuid::new_v4().to_string(),
                start_time,
                rolling_stock: rolling_stock_name.clone(),
                speed_limit_tag: speed_limit_tag.clone(),
                train: PastTrain::new(
                    index,
                    vec![
                        graph::Waypoint {
                            op: OperationalPoint("West_station".into()),
                            stop: true,
                        },
                        graph::Waypoint {
                            op: OperationalPoint("Mid_West_station".into()),
                            stop: false,
                        },
                        graph::Waypoint {
                            op: OperationalPoint("Mid_East_station".into()),
                            stop: true,
                        },
                    ],
                ),
            });
        }

        // MES(44):stop  NES(77):stop
        for index in 3..5 {
            let start_time = Utc::now() + Duration::hours(hour);
            hour += 1;
            traffics.push(TrainTraffic {
                name: Uuid::new_v4().to_string(),
                start_time,
                rolling_stock: rolling_stock_name.clone(),
                speed_limit_tag: speed_limit_tag.clone(),
                train: PastTrain::new(
                    index,
                    vec![
                        graph::Waypoint {
                            op: OperationalPoint("Mid_East_station".into()),
                            stop: true,
                        },
                        graph::Waypoint {
                            op: OperationalPoint("North_East_station".into()),
                            stop: true,
                        },
                    ],
                ),
            });
        }

        let InitTestResponse { app } = init_test(traffics.clone()).await;

        // WS(22):stop  MWS(33):passing_by  MES(44):stop  NES(77):stop
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock_name),
                speed_limit_tag: Some(speed_limit_tag),
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
                        train_name: train_targeted.name.clone(),
                        start_time: train_targeted.start_time,
                    }),
                    begin: "West_station".into(),
                    end: "Mid_East_station".into(),
                },
                SimilarTrainItem {
                    train: Some(TrainInfo {
                        train_name: train_targeted.name,
                        start_time: train_targeted.start_time,
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
        let rolling_stock_name = Uuid::new_v4().to_string();
        let train_1 = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: rolling_stock_name.clone(),
            speed_limit_tag: "MA100".to_string(),
            train: PastTrain::new(
                1,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("West_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_West_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        let train_2 = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: rolling_stock_name.clone(),
            speed_limit_tag: "MA100".to_string(),
            train: PastTrain::new(
                2,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("Mid_East_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("North_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        let InitTestResponse { app } = init_test(vec![train_1.clone(), train_2.clone()]).await;

        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(rolling_stock_name),
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
                        train_name: train_1.name.clone(),
                        start_time: train_1.start_time,
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
                        train_name: train_2.name.clone(),
                        start_time: train_2.start_time,
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
    async fn test_similar_trains_by_relaxing_rolling_stock_criterion() {
        let train_traffic = TrainTraffic {
            name: Uuid::new_v4().to_string(),
            start_time: Utc::now(),
            rolling_stock: Uuid::new_v4().to_string(),
            speed_limit_tag: "MA100".to_string(),
            train: PastTrain::new(
                1,
                vec![
                    graph::Waypoint {
                        op: OperationalPoint("West_station".into()),
                        stop: true,
                    },
                    graph::Waypoint {
                        op: OperationalPoint("Mid_West_station".into()),
                        stop: true,
                    },
                ],
            ),
        };
        let InitTestResponse { app } = init_test(vec![train_traffic.clone()]).await;

        // Request with a bad RS should return NONE
        // Create an
        let db_pool = app.db_pool();
        let bad_rolling_stock_name = Uuid::new_v4().to_string();
        create_fast_rolling_stock(&mut db_pool.get_ok(), &bad_rolling_stock_name).await;
        let request = Request {
            rolling_stock: RollingStockCharacteristics {
                name: Some(bad_rolling_stock_name),
                speed_limit_tag: Some(train_traffic.speed_limit_tag.clone()),
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

        // Relaxing RS constraint should return a result
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
                    train_name: train_traffic.name,
                    start_time: train_traffic.start_time,
                }),
                begin: "West_station".into(),
                end: "Mid_West_station".into(),
            }],
        };
        assert_eq!(response, expected_response);
    }
}
