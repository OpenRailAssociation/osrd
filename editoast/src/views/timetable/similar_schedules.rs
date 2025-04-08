mod graph;
mod new_schedule;
mod past_schedule;

use std::collections::HashSet;
use std::sync::Arc;

use axum::Extension;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Utc;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use core_client::path_properties::PathPropertiesResponse;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use smol_str::SmolStr;
use smol_str::ToSmolStr;
use utoipa::ToSchema;

use crate::ValkeyClient;
use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::models;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::prelude::*;
use crate::models::stdcm_search_environment::StdcmSearchEnvironment;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::pathfinding_from_train_batch;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

editoast_common::schemas! {
    Waypoint,
    WaypointResponse,
}

crate::routes! {
    "/similar_schedules" => {
        similar_schedules,
    },
}

#[derive(Debug, Deserialize, ToSchema)]

struct RollingStockCharacteristics {
    name: String,
    speed_limit_tag: Option<String>,
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypoint)]
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
    #[schema(value_type = Vec<SimilarScheduleWaypoint>)]
    waypoints: Vec<Waypoint>,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypointResponse)]
struct WaypointResponse {
    ci: i64,
    ch: String,
}

#[derive(Debug, Serialize, ToSchema)]
struct SimilarScheduleItem {
    schedule_id: String,
    start_time: DateTime<Utc>,
    #[schema(value_type = SimilarScheduleWaypointResponse)]
    begin: WaypointResponse,
    #[schema(value_type = SimilarScheduleWaypointResponse)]
    end: WaypointResponse,
}

#[derive(Debug, Serialize, ToSchema)]
struct Response {
    #[schema(inline)]
    similar_schedules: Vec<SimilarScheduleItem>,
}

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "timetable:similar_schedules")]
enum SimilarSchedulesError {
    #[error(transparent)]
    #[editoast_error(status = 400)]
    InvalidPath(#[from] new_schedule::ScheduleError),

    #[error("No STDCM search environment setup — contact your administrator")]
    #[editoast_error(status = 500)]
    NoSearchEnvironment,
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
        valkey,
        core_client,
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

    let mut conn = db_pool.get().await?;

    // Step 1: input validation and preprocessing
    // ------------------------------------------

    validate_rolling_stock_input(&mut conn, &rolling_stock, &speed_limit_tag_ids).await?;

    let waypoints = squash_successive_waypoints(waypoints);
    let wp_count = waypoints.len();
    let new_schedule_waypoints = waypoints.into_iter().map(|Waypoint { ci, ch, stop }| {
        if stop {
            new_schedule::Waypoint::stop(ci, Some(ch))
        } else {
            new_schedule::Waypoint::passing_by(ci, Some(ch))
        }
    });
    let new_schedule = new_schedule::NewSchedule::new(new_schedule_waypoints)
        .map_err(SimilarSchedulesError::from)?;

    tracing::debug!(
        n_segments = new_schedule.segment_endpoints().count(),
        n_waypoints = wp_count,
        "pre-processing complete"
    );

    // Step 2: query reference schedules and build the search graph
    // ------------------------------------------------------------

    let Some(StdcmSearchEnvironment {
        timetable_id,
        infra_id,
        ..
    }) = StdcmSearchEnvironment::retrieve_latest_enabled(&mut conn).await
    else {
        return Err(SimilarSchedulesError::NoSearchEnvironment.into());
    };
    let infra = Infra::retrieve_real(conn.clone(), infra_id)
        .await?
        .expect("infra comes from the search environment");

    tracing::debug!(
        infra_id,
        timetable_id,
        "using latest STDCM search environment"
    );

    let candidate_schedules = search_candidate_train_schedules(
        &mut conn,
        &new_schedule,
        timetable_id,
        infra_id,
        rolling_stock,
    )
    .await?;
    if candidate_schedules.is_empty() {
        tracing::info!("no candidate train schedules found — similar trains cannot be computed");
        return Ok(Json(Response {
            similar_schedules: Vec::new(),
        }));
    }

    let selected_past_schedules = simulate_past_schedules(
        &mut conn,
        valkey,
        core_client,
        &infra,
        &new_schedule,
        candidate_schedules,
    )
    .await?;

    let pool = past_schedule::Pool::from_iter(selected_past_schedules);
    for segment in new_schedule.into_segments() {
        let past_schedules = pool.schedules_in_segment(&segment);
        let mut graph = graph::Graph::default();
        for past_schedule in past_schedules {
            let Some(waypoints) = past_schedule.clamp_path(&segment) else {
                panic!("ohno");
            };
            graph.push(past_schedule.name(), waypoints.iter());
        }
        eprintln!("{}", graph.to_dot());
    }

    Ok(Json(Response {
        similar_schedules: vec![
            SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_1".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: WaypointResponse {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: WaypointResponse {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
            SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_2".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: WaypointResponse {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: WaypointResponse {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
        ],
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
        panic!("no such rolling stock, ok bye now");
    }

    if speed_limit_tag
        .as_ref()
        .is_some_and(|tag| !speed_limit_tag_ids.contains(tag))
    {
        panic!("speed limit tag not found");
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

#[tracing::instrument(skip(conn, new_schedule), err)]
async fn search_candidate_train_schedules(
    conn: &mut DbConnection,
    new_schedule: &new_schedule::NewSchedule,
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

    let segments_stops = new_schedule
        .segment_endpoints()
        .filter_map(|(stop1, stop2)| {
            Some((
                (stop1.primary_code(), stop1.secondary_code()?),
                (stop2.primary_code(), stop2.secondary_code()?),
            ))
        })
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
                                Some(((sncf1.ci as u64, sncf1.ch.to_smolstr()), (sncf2.ci as u64, sncf2.ch.to_smolstr())))
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

async fn simulate_past_schedules(
    conn: &mut DbConnection,
    valkey: Arc<ValkeyClient>,
    core_client: Arc<CoreClient>,
    infra: &Infra,
    new_schedule: &new_schedule::NewSchedule,
    candidate_schedules: Vec<models::TrainSchedule>,
) -> Result<Vec<past_schedule::PastSchedule>> {
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
            .filter_map(|(path, ts)| match path {
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
            })
            .collect_vec()
    };

    let path_properties = {
        let futures = paths
            .into_iter()
            .zip(candidate_schedules.into_iter())
            .zip(std::iter::repeat(&core_client))
            .map(|((path, ts), core)| async move {
                let response = PathPropertiesRequest {
                    track_section_ranges: &path.track_section_ranges,
                    infra: infra.id,
                    expected_version: infra.version,
                }
                .fetch(core)
                .await;
                response.map(|properties| (ts, properties))
            });
        futures::future::try_join_all(futures).await?
    };

    let stop_waypoints = new_schedule
        .stops()
        .map(|wp| (wp.primary_code(), wp.secondary_code()))
        .collect::<HashSet<_>>();
    let selected_past_schedules = path_properties
        .into_iter()
        .map(
            |(
                ts,
                PathPropertiesResponse {
                    operational_points, ..
                },
            )| {
                let ops = operational_points.into_iter().filter_map(
                    |OperationalPointOnPath { extensions, .. }| {
                        let sncf = extensions.sncf.as_ref()?;
                        let key = (sncf.ci as u64, Some(sncf.ch.to_smolstr()));
                        Some(graph::Waypoint {
                            stop: stop_waypoints.contains(&key),
                            primary_code: key.0,
                            secondary_code: key.1,
                        })
                    },
                );
                past_schedule::PastSchedule::new(ts.train_name.to_smolstr(), ops)
            },
        )
        .collect_vec();

    Ok(selected_past_schedules)
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
}
