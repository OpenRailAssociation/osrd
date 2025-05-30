use axum::extract::State;
use axum::Extension;
use axum::Json;
use editoast_authz::Role;
use editoast_models::DbConnectionPoolV2;

use axum::extract::State;
use axum::response::IntoResponse;
use core_client::AsCoreRequest as _;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use core_client::path_properties::PathPropertiesResponse;
use editoast_authz::Role;
use editoast_models::DbConnection;
use itertools::Itertools;

use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::prelude::*;
use crate::models::reference_schedule;
use crate::models::reference_schedule::ReferenceSchedule;
use crate::models::timetable::Timetable;
use crate::models::towed_rolling_stock::TowedRollingStockModel;
use crate::models::train_schedule::TrainSchedule;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

crate::routes! {
    "/ref_schedules" => ref_schedules,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct RollingStockCharacteristics {
    name: String,
    towed_rolling_stock: Option<String>,
    speed_limit_tag: Option<String>,
    mass: Option<u64>,
}

#[derive(Debug, Clone, serde::Deserialize, utoipa::ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
struct Waypoint {
    ci: i64,
    ch: String,
    stop: bool,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct RefSchedulesRequest {
    #[schema(inline)]
    rolling_stock: RollingStockCharacteristics,
    #[schema(inline)]
    waypoints: Vec<Waypoint>,
}

#[utoipa::path(
    post, path = "",
    tag = "ref_schedules,stdcm,sncf",
    request_body = inline(RefSchedulesRequest),
    responses(
        (
            status = 200,
            description = "A combination of reference train schedules identifiers similar to the provided schedule",
            body = Vec<String>,
            example = json!(["0098", "1234"])
        ),
    ),
)]
async fn ref_schedules(
    Extension(auth): AuthenticationExt,
    State(AppState {
        db_pool,
        speed_limit_tag_ids,
        ..
    }): State<AppState>,
    Json(RefSchedulesRequest {
        rolling_stock,
        waypoints,
    }): Json<RefSchedulesRequest>,
) -> Result<Json<Vec<String>>> {
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
    let segments = split_segments(waypoints);

    tracing::debug!(
        n_segments = segments.len(),
        n_waypoints = wp_count,
        "pre-processing complete"
    );

    Ok(Json(vec!["12345".to_owned(), "6789".to_owned()]))
}

async fn validate_rolling_stock_input(
    conn: &mut DbConnection,
    RollingStockCharacteristics {
        name,
        towed_rolling_stock,
        speed_limit_tag,
        ..
    }: &RollingStockCharacteristics,
    speed_limit_tag_ids: &SpeedLimitTagIds,
) -> Result<()> {
    if !RollingStock::exists(conn, name.clone()).await? {
        panic!("no such rolling stock, ok bye now");
    }

    if let Some(towed_rolling_stock) = towed_rolling_stock.as_ref() {
        if !TowedRollingStockModel::exists(conn, towed_rolling_stock.clone()).await? {
            panic!("no such towed rolling stock, ok bye now");
        }
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

/// Splits the waypoints into segments between each stops
///
/// The stop waypoint at the end of one segment is included in the next segment.
///
/// # Panics
///
/// The first and last provided waypoints must be stop waypoints.
/// There must be at least two waypoints in the provided list. (duh)
fn split_segments(waypoints: Vec<Waypoint>) -> Vec<Vec<Waypoint>> {
    if waypoints.len() < 2 {
        panic!("Not enough waypoints to split into segments");
    }
    if !waypoints.last().unwrap().stop {
        panic!("Last waypoint is not a stop");
    }

    let mut segments = Vec::<Vec<Waypoint>>::new();
    for waypoint in waypoints {
        if waypoint.stop {
            if let Some(last_segment) = segments.last_mut() {
                last_segment.push(waypoint.clone());
            }
            segments.push(vec![waypoint]);
        } else {
            if let Some(last_segment) = segments.last_mut() {
                last_segment.push(waypoint);
            } else {
                panic!("First waypoint is not a stop");
            }
        }
    }

    if segments.last().map(|s| s.len()) == Some(1) {
        segments.pop();
    }

    segments
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct LoadTimetableRequest {
    timetable_id: i64,
    infra_id: i64,
}

#[utoipa::path(
    put, path = "",
    tag = "ref_schedules,timetable,sncf",
    request_body = inline(LoadTimetableRequest),
    responses( ( status = 204, description = "Timetable schedules loaded as reference schedules successfully" ) ),
)]
async fn load_timetable(
    Extension(auth): AuthenticationExt,
    State(AppState {
        db_pool,
        valkey,
        core_client,
        ..
    }): State<AppState>,
    Json(LoadTimetableRequest {
        timetable_id,
        infra_id,
    }): Json<LoadTimetableRequest>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;

    let _timetable = Timetable::retrieve_real(conn.clone(), timetable_id)
        .await?
        .expect("no such timetable");

    let infra = Infra::retrieve_real(conn.clone(), infra_id)
        .await?
        .expect("no such infra");

    let mut train_schedules = TrainSchedule::list(
        &mut conn,
        SelectionSettings::new().filter(move || TrainSchedule::TIMETABLE_ID.eq(timetable_id)),
    )
    .await?;

    let rolling_stock_names = train_schedules
        .iter()
        .map(|schedule| schedule.rolling_stock_name.clone())
        .collect_vec();

    let rolling_stocks = RollingStock::list(
        &mut conn,
        SelectionSettings::new()
            .filter(move || RollingStock::NAME.eq_any(rolling_stock_names.clone())),
    )
    .await?
    .into_iter()
    .map_into()
    .collect_vec();

    let paths = {
        let paths = pathfinding_from_train_batch(
            &mut conn,
            &mut valkey.get_connection().await?,
            core_client.clone(),
            &infra,
            &train_schedules,
            &rolling_stocks,
        )
        .await?;

        let mut successful_paths = Vec::with_capacity(paths.len());
        let mut removed = 0;
        for (i, path_result) in paths.into_iter().enumerate() {
            match path_result {
                PathfindingResult::Failure(error) => {
                    tracing::warn!(?error, "Pathfinding failed");
                    train_schedules.remove(i - removed);
                    removed += 1;
                }
                PathfindingResult::Success(path) => {
                    successful_paths.push(path);
                }
            }
        }
        successful_paths
    };

    let path_properties_requests = paths
        .iter()
        .map(|path| PathPropertiesRequest {
            track_section_ranges: &path.track_section_ranges,
            infra: infra.id,
            expected_version: infra.version.clone(),
        })
        .collect_vec();

    let waypoints = {
        let mut waypoints = Vec::new();
        waypoints.resize_with(path_properties_requests.len(), Default::default);
        let futures = path_properties_requests
            .into_iter()
            .enumerate()
            .zip(iter::repeat(core_client.clone()))
            .map(|((index, request), client)| async move {
                let response = request.fetch(&client).await;
                response.map(|response| (index, response))
            });
        let properties = futures::future::try_join_all(futures).await?;
        let response_waypoints = properties
            .into_iter()
            .map(
                |(
                    index,
                    PathPropertiesResponse {
                        operational_points, ..
                    },
                )| {
                    let ops = operational_points
                        .into_iter()
                        .map(|OperationalPointOnPath { id, extensions, .. }| {
                            reference_schedule::Waypoint {
                                ci: extensions.sncf.as_ref().unwrap().ci,
                                ch: Some(extensions.sncf.unwrap().ch),
                                stop: train_schedules[index].stops_at(&id),
                            }
                        })
                        .collect_vec();
                    (index, ops)
                },
            )
            .collect_vec();
        for (index, ops) in response_waypoints {
            waypoints[index] = ops;
        }
        waypoints
    };

    let mut changesets = Vec::with_capacity(waypoints.len());
    for (train_schedule, waypoints) in train_schedules.into_iter().zip(waypoints.into_iter()) {
        let stops = train_schedule
            .operational_point_stops(&mut conn, infra.id)
            .await?;
        let cs = ReferenceSchedule::changeset()
            .train_schedule(train_schedule.id)
            .name(train_schedule.train_name)
            .start_date(train_schedule.start_time)
            .traction_engine(train_schedule.rolling_stock_name)
            .towed_rolling_stock(None)
            .speed_limit_tag(train_schedule.speed_limit_tag)
            .weight(Some(100_000))
            .waypoints(waypoints)
            .stop_points_ci(
                stops
                    .into_iter()
                    .map(|stop| Some(stop.schema.extensions.sncf.expect("no SNCF???").ci))
                    .collect(),
            );
        changesets.push(cs);
    }

    let _ = ReferenceSchedule::create_batch::<_, Vec<_>>(&mut conn, changesets).await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;

    #[test]
    fn test_squash_waypoints() {
        let waypoints = Vec::new();
        assert_eq!(squash_successive_waypoints(waypoints), Vec::new());

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_string(),
                stop: false,
            },
        ];
        assert_eq!(squash_successive_waypoints(waypoints.clone()), waypoints);

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            }]
        );

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: true,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: true,
            }]
        );

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_string(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![
                Waypoint {
                    ci: 1,
                    ch: "a".to_string(),
                    stop: false,
                },
                Waypoint {
                    ci: 2,
                    ch: "b".to_string(),
                    stop: false,
                },
            ]
        );
    }

    #[test]
    fn test_segmentation() {
        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_string(),
                stop: true,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 3,
                ch: "c".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 4,
                ch: "d".to_string(),
                stop: true,
            },
            Waypoint {
                ci: 5,
                ch: "e".to_string(),
                stop: false,
            },
            Waypoint {
                ci: 6,
                ch: "f".to_string(),
                stop: true,
            },
            Waypoint {
                ci: 7,
                ch: "g".to_string(),
                stop: true,
            },
        ];

        let segments = split_segments(waypoints.clone());
        assert_eq!(segments[0].as_slice(), &waypoints[0..=3]);
        assert_eq!(segments[1].as_slice(), &waypoints[3..=5]);
        assert_eq!(segments[2].as_slice(), &waypoints[5..=6]);
        assert_eq!(segments.len(), 3);
    }
}
