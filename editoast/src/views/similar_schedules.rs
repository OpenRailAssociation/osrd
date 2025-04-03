use std::iter;

use axum::Extension;
use axum::Json;
use axum::extract::State;
use axum::response::IntoResponse;
use core_client::AsCoreRequest;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use core_client::path_properties::PathPropertiesResponse;
use editoast_authz::Role;
use editoast_models::DbConnectionPoolV2;
use itertools::Itertools;

use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::prelude::*;
use crate::models::reference_schedule;
use crate::models::reference_schedule::ReferenceSchedule;
use crate::models::timetable::Timetable;
use crate::models::train_schedule::TrainSchedule;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;
use super::path::pathfinding::PathfindingResult;
use super::path::pathfinding_from_train_batch;

crate::routes! {
    "/ref_schedules" => {
        ref_schedules,
        "/load_timetable" => load_timetable,
    },
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct RollingStockCharacteristics {
    name: String,
    towed_rolling_stock: Option<String>,
    speed_limit_tag: Option<String>,
    mass: Option<u64>,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
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
    State(db_pool): State<DbConnectionPoolV2>,
    Json(RefSchedulesRequest {
        rolling_stock,
        waypoints,
    }): Json<RefSchedulesRequest>,
) -> crate::error::Result<Json<Vec<String>>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    tracing::info!(
        ?rolling_stock,
        ?waypoints,
        "recieved request, planes are best tho"
    );

    Ok(Json(vec!["12345".to_owned(), "6789".to_owned()]))
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
) -> crate::error::Result<impl IntoResponse> {
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
