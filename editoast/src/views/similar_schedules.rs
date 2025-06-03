mod error;
mod request;
mod response;

use axum::extract::State;
use chrono::DateTime;
use request::Request;
use response::Response;
use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;

use axum::Extension;
use axum::Json;
use editoast_authz::Role;
use educe::Educe;
use itertools::Either;
use itertools::Itertools;

use crate::error::Result;
use crate::models::similar_schedule;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

crate::routes! {
    "/similar_schedules" => similar_schedules,
}

#[utoipa::path(
    post, path = "",
    tag = "similar_schedules,stdcm,sncf",
    request_body = inline(Request),
    responses(
        (
            status = 200,
            description = "A combination of reference train schedules identifiers similar to the provided schedule",
            body = inline(Response),
        ),
    ),
)]
async fn similar_schedules(
    Extension(auth): AuthenticationExt,
    State(AppState {
        db_pool,
        speed_limit_tag_ids,
        ..
    }): State<AppState>,
    Json(Request {
        rolling_stock,
        waypoints,
    }): Json<Request>,
) -> Result<Json<Response>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Step 1: input validation and preprocessing
    // ------------------------------------------

    rolling_stock
        .validate(&mut db_pool.get().await?, &speed_limit_tag_ids)
        .await?;
    let waypoints = request::Waypoint::squash_successive_waypoints(waypoints);
    let waypoints_count = waypoints.len();
    let segments = request::Segment::split_segments(waypoints)?;

    tracing::debug!(
        n_segments = segments.len(),
        n_waypoints = waypoints_count,
        "pre-processing complete"
    );

    // Step 2: query reference schedules and build the search graph
    // ------------------------------------------------------------

    let mut graphs: Vec<(_, _)> = Vec::<(_, _)>::new();
    let mut names = HashSet::new();
    for segment in segments {
        let schedules: Vec<similar_schedule::ReferenceSchedule> = vec![];
        // query_schedules_between_stops(&mut conn, &segment, &rolling_stock).await?;
        tracing::debug!(segment_start = ?segment.begin(), segment_end = ?segment.end(), n_schedules = schedules.len(), "reference schedules queried");

        if schedules.is_empty() {
            return Ok(Json(Response {
                similar_schedules: vec![],
            }));
        }

        let first_waypoint = segment.begin()?;
        let last_waypoint = segment.end()?;

        let selected_schedules = schedules
            .into_iter()
            .filter_map(move |rs| {
                // TODO: relax the CH check for overtakes
                let first = rs.find_waypoint(first_waypoint.ci, Some(&first_waypoint.ch))?;
                let last = rs.find_waypoint(last_waypoint.ci, Some(&last_waypoint.ch))?;
                match rs.inside_segment(&first, &last) {
                    Ok(Either::Left(rs)) => Some(rs),
                    // the waypoints are not in the right order so let's just skip this schedule
                    Ok(Either::Right(())) => None,
                    Err(_) => {
                        unreachable!("the wayponits are in the schedule for sure at this point")
                    }
                }
            })
            .collect_vec();

        tracing::debug!(
            n_selected_schedules = selected_schedules.len(),
            schedules = {
                selected_schedules
                    .iter()
                    .map(|schedule| &schedule.name)
                    .join(",")
            },
            "schedules trimmed and filtered out"
        );

        let sch_names = selected_schedules
            .iter()
            .map(|schedule| schedule.name.clone())
            .collect();
        names = if names.is_empty() {
            sch_names
        } else {
            names.intersection(&sch_names).cloned().collect()
        };

        let mut graph = ReferenceGraph::default();
        for similar_schedule::ReferenceSchedule {
            name, waypoints, ..
        } in selected_schedules
        {
            graph.push(name, waypoints);
        }
        graphs.push((segment, graph));
    }

    // Step 3: try to find each STDCM waypoint in the successive reference graphs
    // --------------------------------------------------------------------------

    let mut schedules = Vec::new();
    for (segment, graph) in graphs {
        eprintln!("{}", graph.to_dot());
        let mut state = MatchingState::new(segment, graph);
        while state.keep_advancing() {
            state = state.advance();
        }
        tracing::debug!(schedules = ?state.correct_schedules_so_far, "reference schedules found for segment");
        schedules.push(state.correct_schedules_so_far);
    }

    // Final step: determine the best combination of schedules
    // -------------------------------------------------------

    let _schedules = decide_best_schedule_combination(schedules);

    let similar_schedules = Response {
        similar_schedules: vec![
            response::SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_1".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: response::Waypoint {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: response::Waypoint {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
            response::SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_2".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: response::Waypoint {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: response::Waypoint {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
        ],
    };

    Ok(Json(similar_schedules))
}

#[derive(Educe)]
#[educe(Debug)]
struct MatchingState {
    path: VecDeque<request::Waypoint>,
    #[educe(Debug = "ignore")]
    graph: ReferenceGraph,
    correct_schedules_so_far: HashSet<String>,
    current_waypoint: similar_schedule::Waypoint,
    skipped: Option<similar_schedule::Waypoint>,
}

impl MatchingState {
    fn new(request::Segment(mut waypoints): request::Segment, graph: ReferenceGraph) -> Self {
        let current_waypoint = waypoints.pop_front().expect("empty segment").into();
        Self {
            path: waypoints,
            graph,
            correct_schedules_so_far: HashSet::new(),
            current_waypoint,
            skipped: None,
        }
    }

    #[inline]
    fn keep_advancing(&self) -> bool {
        !self.path.is_empty()
    }

    fn advance(mut self) -> Self {
        let Some(next_waypoint) = self.path.pop_front() else {
            return self;
        };
        let target = next_waypoint.into();

        tracing::debug!(
            current_waypoint = ?self.current_waypoint,
            target_waypoint = ?target,
            skipped_waypoint = ?self.skipped,
            schedules = ?self.correct_schedules_so_far,
            "matching state iteration"
        );

        let (schedules, current_waypoint, to_skip) = match (
            self.graph.find_successor(&self.current_waypoint, &target),
            self.skipped,
        ) {
            (Some(schedules), _) => (schedules, target, None),
            (None, None) => (HashSet::new(), self.current_waypoint, Some(target)),
            (None, Some(skipped)) => {
                panic!(
                    "graph exploration failed: having to skip both successive waypoints {skipped:?} and {:?}",
                    &self.current_waypoint
                );
            }
        };

        Self {
            correct_schedules_so_far: if self.correct_schedules_so_far.is_empty() {
                schedules
            } else if schedules.is_empty() {
                self.correct_schedules_so_far
            } else {
                self.correct_schedules_so_far
                    .intersection(&schedules)
                    .cloned()
                    .collect()
            },
            current_waypoint,
            path: self.path,
            graph: self.graph,
            skipped: to_skip,
        }
    }
}

type Graph = petgraph::graph::DiGraph<GraphNode, ()>;
type NodeIndex = petgraph::graph::NodeIndex;

#[derive(Debug)]
struct GraphNode {
    waypoint: similar_schedule::Waypoint,
    schedules: HashSet<String>,
}

#[derive(Debug, Default)]
struct ReferenceGraph {
    graph: Graph,
    // index: ci -> ch -> node_index
    cich_index: HashMap<u32, HashMap<Option<String>, NodeIndex>>,
}

impl ReferenceGraph {
    fn get_or_create_node(
        &mut self,
        waypoint: similar_schedule::Waypoint,
        schedule_name: &str,
    ) -> NodeIndex {
        if let Some(node) = self
            .cich_index
            .get(&waypoint.ci)
            .and_then(|map| map.get(&waypoint.ch))
        {
            self.graph
                .node_weight_mut(*node)
                .unwrap()
                .schedules
                .insert(schedule_name.to_owned());
            *node
        } else {
            let ci = waypoint.ci;
            let ch = waypoint.ch.clone();
            let node = self.graph.add_node(GraphNode {
                waypoint,
                schedules: HashSet::new(),
            });
            self.cich_index.entry(ci).or_default().insert(ch, node);
            node
        }
    }

    fn push(&mut self, schedule_name: String, waypoints: Vec<similar_schedule::Waypoint>) {
        for (wp1, wp2) in waypoints.into_iter().tuple_windows() {
            let from = self.get_or_create_node(wp1, &schedule_name);
            let to = self.get_or_create_node(wp2, &schedule_name);
            self.graph
                .find_edge(from, to)
                .unwrap_or_else(|| self.graph.add_edge(from, to, ()));
        }
    }

    fn find_successor(
        &self,
        train_location: &similar_schedule::Waypoint,
        target_location: &similar_schedule::Waypoint,
    ) -> Option<HashSet<String>> {
        let from = self
            .cich_index
            .get(&train_location.ci)
            .and_then(|map| map.get(&train_location.ch))
            .expect("graph construction fail");
        let to = self
            .cich_index
            .get(&target_location.ci)
            .and_then(|map| map.get(&target_location.ch))?;

        let aetoile = petgraph::algo::astar(&self.graph, *from, |n| n == *to, |_| 1, |_| 0);

        match aetoile {
            Some((_, path)) if !path.is_empty() && path.len() <= 2 => {
                let mut schedules = self.graph.node_weight(*from).unwrap().schedules.clone();
                debug_assert_eq!(path.first(), Some(from));
                debug_assert_eq!(path.last(), Some(to));
                for node in path.into_iter().skip(1) {
                    let on_path = &self.graph.node_weight(node).unwrap().schedules;
                    schedules = schedules.intersection(on_path).cloned().collect();
                }
                Some(schedules)
            }
            Some(_) | None => None,
        }
    }

    fn to_dot(&self) -> String {
        let pretty = self.graph.map(
            |_,
             GraphNode {
                 waypoint: similar_schedule::Waypoint { ci, ch, stop },
                 schedules,
             }| {
                let mut names = schedules
                    .iter()
                    .map(|name| name.as_str())
                    .collect::<Vec<_>>();
                names.sort();
                let names = names.join(",");
                format!(
                    "{ci}:{}{}  —  {names}",
                    ch.as_deref().unwrap_or("ø"),
                    if *stop { "[STOP]" } else { "" }
                )
            },
            |_, ()| String::new(),
        );
        let dot = petgraph::dot::Dot::with_config(&pretty, &[petgraph::dot::Config::EdgeNoLabel]);
        format!("{dot:?}").replace("\\\"", "")
    }
}

// async fn query_schedules_between_stops(
//     conn: &mut DbConnection,
//     segment: &Segment,
//     RollingStockCharacteristics {
//         name,
//         towed_rolling_stock,
//         speed_limit_tag,
//         mass,
//     }: &RollingStockCharacteristics,
// ) -> Result<Vec<ReferenceSchedule>> {
//     let stops = vec![segment.begin().ci, segment.end().ci];

//     // use diesel::expression_methods::ExpressionMethods as _;
//     use diesel::expression_methods::PgArrayExpressionMethods as _;
//     use diesel_async::RunQueryDsl as _;
//     use editoast_models::tables::reference_schedule::dsl;

//     let rows = dsl::reference_schedule
//         .select(editoast_models::tables::reference_schedule::all_columns)
//         .filter(dsl::stop_points_ci.contains(stops))
//         // .filter(dsl::traction_engine.eq(name))
//         // .filter(dsl::towed_rolling_stock.eq(towed_rolling_stock))
//         // .filter(dsl::speed_limit_tag.eq(speed_limit_tag))
//         // .filter(dsl::weight.ge(mass.map(|m| m as i64)))
//         .load::<Row<ReferenceSchedule>>(&mut conn.write().await)
//         .await?;

//     let schedules = rows
//         .into_iter()
//         .map(|row| ReferenceSchedule::from_row(row))
//         .collect();

//     Ok(schedules)
// }

fn decide_best_schedule_combination(mut segments_schedules: Vec<HashSet<String>>) -> Vec<String> {
    let mut schedules = Vec::new();

    while !segments_schedules.is_empty() {
        let longest_train = {
            let mut histo = std::collections::BinaryHeap::new();
            let mut train_count = HashMap::new();

            for segment in &segments_schedules {
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
        segments_schedules.retain(|segment| !segment.contains(&longest_train));
        schedules.push(longest_train);
    }

    schedules
}

// #[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
// struct LoadTimetableRequest {
//     timetable_id: i64,
//     infra_id: i64,
// }

// #[utoipa::path(
//     put, path = "",
//     tag = "ref_schedules,timetable,sncf",
//     request_body = inline(LoadTimetableRequest),
//     responses( ( status = 204, description = "Timetable schedules loaded as reference schedules successfully" ) ),
// )]
// async fn load_timetable(
//     Extension(auth): AuthenticationExt,
//     State(AppState {
//         db_pool,
//         valkey,
//         core_client,
//         ..
//     }): State<AppState>,
//     Json(LoadTimetableRequest {
//         timetable_id,
//         infra_id,
//     }): Json<LoadTimetableRequest>,
// ) -> Result<impl IntoResponse> {
//     let authorized = auth
//         .check_roles([Role::Admin].into())
//         .await
//         .map_err(AuthorizationError::AuthError)?;
//     if !authorized {
//         return Err(AuthorizationError::Forbidden.into());
//     }

//     let mut conn = db_pool.get().await?;

//     let _timetable = Timetable::retrieve_real(conn.clone(), timetable_id)
//         .await?
//         .expect("no such timetable");

//     let infra = Infra::retrieve_real(conn.clone(), infra_id)
//         .await?
//         .expect("no such infra");

//     let mut train_schedules = TrainSchedule::list(
//         &mut conn,
//         SelectionSettings::new().filter(move || TrainSchedule::TIMETABLE_ID.eq(timetable_id)),
//     )
//     .await?;

//     let rolling_stock_names = train_schedules
//         .iter()
//         .map(|schedule| schedule.rolling_stock_name.clone())
//         .collect_vec();

//     let rolling_stocks = RollingStock::list(
//         &mut conn,
//         SelectionSettings::new()
//             .filter(move || RollingStock::NAME.eq_any(rolling_stock_names.clone())),
//     )
//     .await?
//     .into_iter()
//     .map_into()
//     .collect_vec();

//     let paths = {
//         let paths = pathfinding_from_train_batch(
//             &mut conn,
//             &mut valkey.get_connection().await?,
//             core_client.clone(),
//             &infra,
//             &train_schedules,
//             &rolling_stocks,
//         )
//         .await?;

//         let mut successful_paths = Vec::with_capacity(paths.len());
//         let mut removed = 0;
//         for (i, path_result) in paths.into_iter().enumerate() {
//             match path_result {
//                 PathfindingResult::Failure(error) => {
//                     tracing::warn!(?error, "Pathfinding failed");
//                     train_schedules.remove(i - removed);
//                     removed += 1;
//                 }
//                 PathfindingResult::Success(path) => {
//                     successful_paths.push(path);
//                 }
//             }
//         }
//         successful_paths
//     };

//     let path_properties_requests = paths
//         .iter()
//         .map(|path| PathPropertiesRequest {
//             track_section_ranges: &path.track_section_ranges,
//             infra: infra.id,
//             expected_version: infra.version.clone(),
//         })
//         .collect_vec();

//     let waypoints = {
//         let mut waypoints = Vec::new();
//         waypoints.resize_with(path_properties_requests.len(), Default::default);
//         let futures = path_properties_requests
//             .into_iter()
//             .enumerate()
//             .zip(iter::repeat(core_client.clone()))
//             .map(|((index, request), client)| async move {
//                 let response = request.fetch(&client).await;
//                 response.map(|response| (index, response))
//             });
//         let properties = futures::future::try_join_all(futures).await?;
//         let response_waypoints = properties
//             .into_iter()
//             .map(
//                 |(
//                     index,
//                     PathPropertiesResponse {
//                         operational_points, ..
//                     },
//                 )| {
//                     let ops = operational_points
//                         .into_iter()
//                         .map(|OperationalPointOnPath { id, extensions, .. }| {
//                             similar_schedule::Waypoint {
//                                 ci: extensions.sncf.as_ref().unwrap().ci,
//                                 ch: Some(extensions.sncf.unwrap().ch),
//                                 stop: train_schedules[index].stops_at(&id),
//                             }
//                         })
//                         .collect_vec();
//                     (index, ops)
//                 },
//             )
//             .collect_vec();
//         for (index, ops) in response_waypoints {
//             waypoints[index] = ops;
//         }
//         waypoints
//     };

//     let mut changesets = Vec::with_capacity(waypoints.len());
//     for (train_schedule, waypoints) in train_schedules.into_iter().zip(waypoints.into_iter()) {
//         let stops = train_schedule
//             .operational_point_stops(&mut conn, infra.id)
//             .await?;
//         let cs = ReferenceSchedule::changeset()
//             .train_schedule(train_schedule.id)
//             .name(train_schedule.train_name)
//             .start_date(train_schedule.start_time)
//             .traction_engine(train_schedule.rolling_stock_name)
//             .towed_rolling_stock(None)
//             .speed_limit_tag(train_schedule.speed_limit_tag)
//             .weight(Some(100_000))
//             .waypoints(waypoints)
//             .stop_points_ci(
//                 stops
//                     .into_iter()
//                     .map(|stop| Some(stop.schema.extensions.sncf.expect("no SNCF???").ci))
//                     .collect(),
//             );
//         changesets.push(cs);
//     }

//     let _ = ReferenceSchedule::create_batch::<_, Vec<_>>(&mut conn, changesets).await?;

//     Ok(axum::http::StatusCode::NO_CONTENT)
// }
