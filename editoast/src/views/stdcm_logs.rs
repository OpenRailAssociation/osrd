use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use axum::Json;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::stdcm_log::StdcmLog;
use crate::Retrieve;

use super::pagination::PaginatedList;
use super::pagination::PaginationQueryParams;
use super::pagination::PaginationStats;
use super::AuthenticationExt;
use super::AuthorizationError;

crate::routes! {
    "/stdcm_logs" => list_stdcm_logs,
    "/stdcm_log" => stdcm_log_by_id_or_trace_id,
}

editoast_common::schemas! {
    StdcmLogListItem,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "stdcm_log")]
enum StdcmLogError {
    #[error("STDCM log entry '{trace_id}' could not be found")]
    #[editoast_error(status = 404)]
    TraceIdNotFound { trace_id: String },

    #[error("STDCM log entry '{id}' could not be found")]
    #[editoast_error(status = 404)]
    NotFound { id: i64 },

    #[error("STDCM log entry could not be found without specifying an 'id' or 'trace_id'")]
    #[editoast_error(status = 400)]
    MissingIdAndTraceId,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct StdcmLogListItem {
    id: i64,
    trace_id: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct StdcmLogListResponse {
    results: Vec<StdcmLogListItem>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[utoipa::path(
    get, path = "",
    tag = "stdcm_log",
    params(PaginationQueryParams),
    responses(
        (status = 200, body = inline(StdcmLogListResponse), description = "The list of STDCM Logs"),
    )
)]
async fn list_stdcm_logs(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Query(pagination_params): Query<PaginationQueryParams>,
) -> Result<Json<StdcmLogListResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let settings = pagination_params.validate(25)?.into_selection_settings();

    let (stdcm_logs, stats) = StdcmLog::list_paginated(conn, settings).await?;

    let results = stdcm_logs
        .into_iter()
        .map(|stdcm_log| StdcmLogListItem {
            id: stdcm_log.id,
            trace_id: stdcm_log.trace_id,
        })
        .collect();

    Ok(Json(StdcmLogListResponse { results, stats }))
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct StdcmLogParams {
    trace_id: Option<String>,
    id: Option<i64>,
}

#[utoipa::path(
    get, path = "",
    params(StdcmLogParams),
    tag = "stdcm_log",
    responses(
        (status = 200, body = StdcmLog, description = "The STDCM log"),
    )
)]
async fn stdcm_log_by_id_or_trace_id(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Query(StdcmLogParams { id, trace_id }): Query<StdcmLogParams>,
) -> Result<Json<StdcmLog>> {
    let authorized = auth
        .check_roles([BuiltinRole::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    if id.is_some() {
        let stdcm_log = StdcmLog::retrieve_or_fail(conn, id.unwrap(), || StdcmLogError::NotFound {
            id: id.unwrap(),
        })
        .await?;
        Ok(Json(stdcm_log))
    } else if trace_id.is_some() {
        let stdcm_log = StdcmLog::retrieve_or_fail(conn, Some(trace_id.clone().unwrap()), || {
            StdcmLogError::TraceIdNotFound {
                trace_id: trace_id.unwrap(),
            }
        })
        .await?;
        Ok(Json(stdcm_log))
    } else {
        Err(StdcmLogError::MissingIdAndTraceId.into())
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use axum::http::StatusCode;
    use chrono::DateTime;
    use editoast_authz::subject::UserInfo;
    use editoast_authz::BuiltinRole;
    use editoast_schemas::train_schedule::Comfort;
    use editoast_schemas::train_schedule::MarginValue;
    use editoast_schemas::train_schedule::OperationalPointIdentifier;
    use editoast_schemas::train_schedule::OperationalPointReference;
    use editoast_schemas::train_schedule::PathItemLocation;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use tracing_subscriber::filter::Directive;
    use uuid::Uuid;

    use crate::core;
    use crate::core::mocking::MockingClient;
    use crate::core::pathfinding::PathfindingResultSuccess;
    use crate::core::simulation::CompleteReportTrain;
    use crate::core::simulation::ElectricalProfiles;
    use crate::core::simulation::ReportTrain;
    use crate::core::simulation::SimulationResponse;
    use crate::core::simulation::SpeedLimitProperties;
    use crate::core::CoreClient;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::stdcm_log::StdcmLog;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::stdcm_logs::StdcmLogListResponse;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::test_app::TestRequestExt;
    use crate::views::timetable::stdcm::request::PathfindingItem;
    use crate::views::timetable::stdcm::request::Request;
    use crate::views::timetable::stdcm::request::StepTimingData;

    fn stdcm_payload(rolling_stock_id: i64) -> Request {
        Request {
            start_time: None,
            steps: vec![
                PathfindingItem {
                    duration: Some(0),
                    location: PathItemLocation::OperationalPointReference(
                        OperationalPointReference {
                            reference: OperationalPointIdentifier::OperationalPointDescription {
                                trigram: "WS".into(),
                                secondary_code: Some("BV".to_string()),
                            },
                            track_reference: None,
                        },
                    ),
                    timing_data: Some(StepTimingData {
                        arrival_time: DateTime::from_str("2024-09-17T20:05:00+02:00")
                            .expect("Failed to parse datetime"),
                        arrival_time_tolerance_before: 0,
                        arrival_time_tolerance_after: 0,
                    }),
                },
                PathfindingItem {
                    duration: Some(0),
                    location: PathItemLocation::OperationalPointReference(
                        OperationalPointReference {
                            reference: OperationalPointIdentifier::OperationalPointDescription {
                                trigram: "MWS".into(),
                                secondary_code: Some("BV".to_string()),
                            },
                            track_reference: None,
                        },
                    ),
                    timing_data: None,
                },
            ],
            rolling_stock_id,
            towed_rolling_stock_id: None,
            electrical_profile_set_id: None,
            work_schedule_group_id: None,
            temporary_speed_limit_group_id: None,
            comfort: Comfort::Standard,
            maximum_departure_delay: None,
            maximum_run_time: None,
            speed_limit_tags: Some("AR120".to_string()),
            time_gap_before: 35000,
            time_gap_after: 35000,
            margin: Some(MarginValue::MinPer100Km(4.5)),
            total_mass: None,
            total_length: None,
            max_speed: None,
            loading_gauge_type: None,
        }
    }

    fn core_mocking_client() -> CoreClient {
        let mut core = MockingClient::new();
        core.stub("/v2/pathfinding/blocks")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/v2/standalone_simulation")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(simulation_response())
            .finish();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(core::stdcm::Response::Success {
                simulation: simulation_response(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();
        CoreClient::Mocked(core)
    }

    fn pathfinding_result_success() -> PathfindingResultSuccess {
        PathfindingResultSuccess {
            blocks: vec![],
            routes: vec![],
            track_section_ranges: vec![],
            length: 1,
            path_item_positions: vec![0, 10],
        }
    }

    fn simulation_response() -> SimulationResponse {
        SimulationResponse::Success {
            base: ReportTrain {
                positions: vec![],
                times: vec![],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 10],
            },
            provisional: ReportTrain {
                positions: vec![],
                times: vec![0, 10],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 10],
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    positions: vec![],
                    times: vec![],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 10],
                },
                signal_critical_positions: vec![],
                zone_updates: vec![],
                spacing_requirements: vec![],
                routing_requirements: vec![],
            },
            mrsp: SpeedLimitProperties {
                boundaries: vec![],
                values: vec![],
            },
            electrical_profiles: ElectricalProfiles {
                boundaries: vec![],
                values: vec![],
            },
        }
    }

    async fn execute_stdcm_request(app: &TestApp, user: Option<UserInfo>) -> String {
        let small_infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let timetable = create_timetable(&mut app.db_pool().get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut app.db_pool().get_ok(), &Uuid::new_v4().to_string())
                .await;
        let trace_id = "cd62312a1bd0df0a612ff9ade3d03635".to_string();
        let mut request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&stdcm_payload(rolling_stock.id))
            .add_header("traceparent", format!("00-{trace_id}-18ae0228cf2d63b0-01"));

        if let Some(user) = user {
            request = request.by_user(user);
        }
        app.fetch(request).assert_status(StatusCode::OK);

        trace_id
    }

    fn rust_log() -> Directive {
        "otel::tracing=info".parse().unwrap()
    }

    #[rstest]
    async fn list_stdcm_logs_return_success() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Admin])
            .create();
        let trace_id = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app.get("/stdcm_logs").by_user(user);
        let stdcm_logs_response: StdcmLogListResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(stdcm_logs_response.results.len(), 1);
        assert_eq!(stdcm_logs_response.results[0].trace_id, Some(trace_id));
    }

    #[rstest]
    async fn get_stdcm_log_by_trace_id_return_success() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Admin])
            .create();
        let trace_id = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app
            .get(format!("/stdcm_log?trace_id={trace_id}").as_str())
            .by_user(user);
        let stdcm_log: StdcmLog = app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(stdcm_log.trace_id, Some(trace_id));
    }

    #[rstest]
    async fn get_stdcm_log_by_trace_id_return_not_found() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Admin])
            .create();
        let _ = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app
            .get("/stdcm_log?trace_id=not_existing_trace_id")
            .by_user(user);
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_stdcm_log_by_id_return_not_found() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Admin])
            .create();
        let _ = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app.get("/stdcm_log?id=0").by_user(user);
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_stdcm_log_return_missing_id_and_trace_id() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Admin])
            .create();
        let _ = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app.get("/stdcm_log").by_user(user);
        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_stdcm_log_by_trace_id_return_unauthorized() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Stdcm]) // only available to admins
            .create();
        let trace_id = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app
            .get(format!("/stdcm_log?trace_id={trace_id}").as_str())
            .by_user(user);
        app.fetch(request).assert_status(StatusCode::FORBIDDEN);
    }

    #[rstest]
    async fn get_stdcm_log_by_trace_id_return_empty_used_id() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(false)
            .enable_stdcm_logging(true)
            .enable_telemetry(true)
            .with_rust_log_directive(rust_log())
            .build();
        let trace_id = execute_stdcm_request(&app, None).await;
        let request = app.get(format!("/stdcm_log?trace_id={trace_id}").as_str());
        let stdcm_log: StdcmLog = app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(stdcm_log.user_id, None);
    }

    #[rstest]
    async fn list_stdcm_logs_return_empty_trace_id() {
        let app = test_app!()
            .core_client(core_mocking_client())
            .enable_authorization(true)
            .enable_stdcm_logging(true)
            .enable_telemetry(false)
            .with_rust_log_directive(rust_log())
            .build();
        let user = app
            .user("bob", "Bob")
            .with_roles([BuiltinRole::Admin])
            .create();
        let _ = execute_stdcm_request(&app, Some(user.clone())).await;
        let request = app.get("/stdcm_logs").by_user(user);
        let stdcm_logs_response: StdcmLogListResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(stdcm_logs_response.results.len(), 1);
        assert_eq!(stdcm_logs_response.results[0].trace_id, None);
    }
}
