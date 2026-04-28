pub(crate) mod request;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse;
use axum::response::Response;
use axum_streams::StreamBodyAs;
use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::InvalidPathItem;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::stdcm::ConsistConfiguration;
use core_client::stdcm::ConsistSchedule;
use core_client::stdcm::Request as StdcmRequest;
use core_client::stdcm::UndirectedTrackRange;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use futures::StreamExt as _;
use futures::stream;
use geos::geojson::Geometry;
use geos::geojson::Value;
use itertools::Itertools as _;
use request::Request;
use request::convert_steps;
use schemas::primitives::PositiveDuration;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::Margins;
use schemas::train_schedule::ReceptionSignal;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainOccurrence;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::max;
use std::collections::HashSet;
use std::pin::pin;
use std::sync::Arc;
use thiserror::Error;
use tokio::spawn;
use tokio::sync::mpsc;
use tracing::Instrument as _;
use tracing::Span;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::timetable::PhysicsConsistParameters;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::consist_train_simulation_batch;
use editoast_models::Infra;
use editoast_models::WorkSchedule;
use editoast_models::prelude::*;
use editoast_models::rolling_stock::RollingStock;
use editoast_models::timetable::Timetable;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
#[schema(title_variants)]
pub(in crate::views) enum StdcmResponse {
    Success {
        simulation: SimulationResponseSuccess,
        pathfinding_result: PathfindingResultSuccess,
        departure_time: DateTime<Utc>,
        #[serde(skip_serializing_if = "Option::is_none")]
        core_payload: Option<StdcmRequest>,
    },
    PathNotFound {
        #[serde(skip_serializing_if = "Option::is_none")]
        core_payload: Option<StdcmRequest>,
    },
    PreprocessingSimulationError {
        error: simulation::Response,
        #[serde(skip_serializing_if = "Option::is_none")]
        core_payload: Option<StdcmRequest>,
    },
    InternalError {
        error: InternalError,
        #[serde(skip_serializing_if = "Option::is_none")]
        core_payload: Option<StdcmRequest>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
struct StdcmProgressionEvent {
    #[schema(value_type = common::geometry::GeoJsonPoint)]
    point: Geometry,
    best_travel_time: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "event", rename_all = "snake_case", content = "data")]
#[allow(clippy::large_enum_variant)]
enum StdcmProgression {
    Ongoing(StdcmProgressionEvent),
    Completed(StdcmResponse),
}

#[derive(Debug, Error, EditoastError, Serialize, derive_more::From)]
#[editoast_error(base_id = "stdcm")]
enum StdcmError {
    #[error("Infrastructure {infra_id} does not exist")]
    InfraNotFound { infra_id: i64 },
    #[error("Timetable {timetable_id} does not exist")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error("{:?} rolling stock(s) could not be found", .ids)]
    #[editoast_error(status = 404)]
    BatchRollingStockNotFound { ids: HashSet<i64> },
    #[error("Towed rolling stock {towed_rolling_stock_id} does not exist")]
    TowedRollingStockNotFound { towed_rolling_stock_id: i64 },
    #[error("Train simulation fail")]
    TrainSimulationFail,
    #[error("Path items are invalid")]
    InvalidPathItems { items: Vec<InvalidPathItem> },
    #[error(
        "Invalid consist mass {provided_consist_mass}: it should be greater than {expected_min}"
    )]
    InvalidConsistMass {
        provided_consist_mass: f64,
        expected_min: f64,
    },
    #[error(
        "Invalid consist length {provided_consist_length}: it should be greater than {expected_min}"
    )]
    InvalidConsistLength {
        provided_consist_length: f64,
        expected_min: f64,
    },
    #[error(transparent)]
    #[from(forward)]
    #[serde(skip)]
    Database(editoast_models::Error),
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct StdcmQueryParams {
    /// The infra id
    #[param(required = true)]
    infra: i64,
    /// If true, extra payloads are returned to help with debugging
    #[schema(required = false)]
    #[serde(default)]
    #[param(nullable)]
    return_debug_payloads: bool,
}

/// This function computes a STDCM and returns the result.
/// It first checks user authorization, then retrieves timetable, infrastructure,
/// train schedules, and rolling stock data, and runs train simulations.
/// The result contains the simulation output based on the train schedules
/// and infrastructure provided.
///
/// If the simulation fails, the function uses a virtual train to detect conflicts
/// with existing train schedules. It then returns both the conflict information
/// and the pathfinding result from the virtual train's simulation.
#[tracing::instrument(
    target = "editoast::timetable",
    name = "stdcm",
    skip_all,
    err,
    fields(
        request,
        timetable_id = id,
        infra_id = query.infra,
        path_found,
    )
)]
#[editoast_derive::route(authz::Role::Stdcm)]
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    request_body = inline(Request),
    params(
        ("id" = i64, Path, description = "timetable_id"),
        StdcmQueryParams,
    ),
    responses(
        (status = 200, body = inline(StdcmProgression), description = "The simulation result"),
    )
)]
pub(in crate::views) async fn stdcm(
    state: State<AppState>,
    extension: AuthenticationExt,
    Path(id): Path<i64>,
    Query(query): Query<StdcmQueryParams>,
    Json(request): Json<Request>,
) -> Result<impl IntoResponse> {
    // Add serialized request to trace attributes, skipping allowed track sections
    // (as it would make the payload too large to be saved). TODO: include search env ID
    let mut request_copy = request.clone();
    request_copy.allowed_track_sections = None;
    Span::current().record("request", serde_json::to_string(&request_copy)?);
    let mut returned_request: Option<core_client::stdcm::Request> = None;
    stdcm_handler(
        state,
        extension,
        Path(id),
        Query(query),
        Json(request),
        &mut returned_request,
    )
    .await
    .map_err(|mut err| {
        if let Some(request) = returned_request {
            err.context.insert(
                String::from("core_payload"),
                serde_json::to_value(request).unwrap_or(serde_json::Value::Null),
            );
        }
        err
    })
}

pub(in crate::views) async fn stdcm_handler(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(id): Path<i64>,
    Query(query): Query<StdcmQueryParams>,
    Json(request): Json<Request>,
    returned_request: &mut Option<core_client::stdcm::Request>,
) -> Result<Response> {
    let mut conn = db_pool.get().await?;

    let timetable_id = id;
    let infra_id = query.infra;
    // Default 12h value when the simulation fails
    const DEFAULT_VALUE_FAILED_SIMULATION: u64 = 12 * 3_600_000;

    // 1. Get Infra
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || StdcmError::InfraNotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.clone()
        .check_authorization(async |authorizer| {
            authorizer
                .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
                .await
        })
        .await?;

    // 2. Get Timetable / Work schedules
    Timetable::exists_or_fail(&mut conn, timetable_id, || StdcmError::TimetableNotFound {
        timetable_id,
    })
    .await?;
    let work_schedules = request.get_work_schedules(&mut conn).await?;

    // 3. Get RollingStock
    let consist_configs = if request.consist_schedule.values.is_empty() {
        vec![request::ConsistConfiguration {
            rolling_stock_id: request.rolling_stock_id,
            towed_rolling_stock_id: request.towed_rolling_stock_id,
            total_mass: request.total_mass,
            total_length: request.total_length,
            max_speed: request.max_speed,
            speed_limit_tag: request.speed_limit_tags.clone(),
            loading_gauge_type: request.loading_gauge_type,
        }]
    } else {
        request.consist_schedule.values.clone()
    };

    let rolling_stock_ids: Vec<i64> = consist_configs
        .iter()
        .map(|consist_config| consist_config.rolling_stock_id)
        .collect();

    let rolling_stocks_models: Vec<RollingStock> = RollingStock::retrieve_batch_or_fail(
        &mut conn.clone(),
        rolling_stock_ids.clone(),
        |missing| StdcmError::BatchRollingStockNotFound { ids: missing },
    )
    .await?;

    let rolling_stocks_models: Vec<RollingStock> = rolling_stock_ids
        .iter()
        .map(|id| {
            rolling_stocks_models
                .iter()
                .find(|rs| rs.id == *id)
                .cloned()
                .unwrap()
        })
        .collect();

    let rolling_stocks: Vec<schemas::RollingStock> =
        rolling_stocks_models.into_iter().map(Into::into).collect();

    let mut physics_consists_parameters = vec![];
    for (consist, rolling_stock) in consist_configs.iter().zip(rolling_stocks) {
        let towed_rolling_stock = consist
            .get_towed_rolling_stock(&mut conn)
            .await?
            .map(From::from);

        consist.validate_consist(&rolling_stock, towed_rolling_stock.as_ref())?;
        physics_consists_parameters.push(PhysicsConsistParameters {
            max_speed: consist.max_speed,
            total_length: consist.total_length,
            total_mass: consist.total_mass,
            towed_rolling_stock,
            traction_engine: rolling_stock,
        });
    }

    // 4. Compute the earliest start time and maximum departure delay
    let virtual_train_runs = VirtualTrainRun::simulate_consists_sequence(
        db_pool.clone(),
        valkey_client.clone(),
        core_client.clone(),
        config.app_version.as_deref(),
        &request,
        &infra,
        &physics_consists_parameters,
    )
    .await?;

    let (mut pathfinding_failures, runs): (Vec<_>, Vec<_>) =
        virtual_train_runs.into_iter().partition(|run| {
            matches!(
                run.simulation,
                simulation::Response::PathfindingFailed { .. }
            )
        });
    if let Some(failure) = pathfinding_failures.pop() {
        let payload = StdcmResponse::PreprocessingSimulationError {
            error: failure.simulation,
            core_payload: None,
        };
        return Ok(StreamBodyAs::json_nl(stream::once(async { payload })).into_response());
    }

    let total_simulation_run_time = runs
        .iter()
        .map(|run| run.simulation.simulation_run_time())
        .sum::<Option<_>>()
        .unwrap_or(DEFAULT_VALUE_FAILED_SIMULATION);

    let earliest_departure_time = request.get_earliest_departure_time(total_simulation_run_time);
    let latest_simulation_end = request.get_latest_simulation_end(total_simulation_run_time);

    let stdcm_consist_schedule_values = consist_configs
        .iter()
        .zip(physics_consists_parameters.iter())
        .map(
            |(consist_config, physics_consist_param)| ConsistConfiguration {
                loading_gauge_type: consist_config
                    .loading_gauge_type
                    .unwrap_or(physics_consist_param.traction_engine.loading_gauge),
                supported_signaling_systems: physics_consist_param
                    .traction_engine
                    .supported_signaling_systems(),
                speed_limit_tag: consist_config.speed_limit_tag.clone(),
                physics_consist: physics_consist_param.clone().into(),
            },
        )
        .collect_vec();

    // 5. Build STDCM request
    let stdcm_request = StdcmRequest {
        infra: infra.id,
        expected_version: infra.version,
        timetable_id,
        allowed_track_sections: request.allowed_track_sections.clone(),
        consist_schedule: ConsistSchedule {
            boundaries: request.consist_schedule.boundaries.clone(),
            values: stdcm_consist_schedule_values,
        },
        temporary_speed_limits: request
            .get_temporary_speed_limits(&mut conn, total_simulation_run_time)
            .await?,
        comfort: request.comfort,
        path_items: request.get_stdcm_path_items(conn, infra_id).await?,
        start_time: earliest_departure_time,
        maximum_departure_delay: request.get_maximum_departure_delay(total_simulation_run_time),
        maximum_run_time: request.get_maximum_run_time(total_simulation_run_time),
        time_gap_before: request.time_gap_before,
        time_gap_after: request.time_gap_after,
        margin: request.margin,
        time_step: Some(2000),
        work_schedules: work_schedules
            .iter()
            .filter_map(|ws| {
                as_core_work_schedule(ws, earliest_departure_time, latest_simulation_end)
            })
            .collect(),
    };
    *returned_request = query.return_debug_payloads.then_some(stdcm_request.clone());

    let (tx, rx) = mpsc::unbounded_channel();
    let core_payload = returned_request.clone();

    let stream_result_lambda = async move {
        let stream_stdcm_response = stdcm_request
            .fetch_streaming::<core_client::Json<core_client::stdcm::ProgressStatus>>(
                core_client.as_ref(),
            )
            .await
            .map_err(InternalError::from);
        let stream_stdcm_response = match stream_stdcm_response {
            Ok(stream_stdcm_response) => stream_stdcm_response,
            Err(e) => {
                let _ = tx.send(StdcmProgression::Completed(StdcmResponse::InternalError {
                    error: e,
                    core_payload: core_payload.clone(),
                }));
                return;
            }
        };

        // 6. Handle STDCM Core Response
        let result_stream = stream_stdcm_response.map(move |response| {
            let response = response.map_err(InternalError::from);

            let span = Span::current();

            match response {
                Ok(result) => match result {
                    core_client::stdcm::ProgressStatus::InProgress {
                        point,
                        best_travel_time,
                    } => StdcmProgression::Ongoing(StdcmProgressionEvent {
                        point: Geometry::new(Value::Point(vec![point.lon, point.lat])),
                        best_travel_time,
                    }),
                    core_client::stdcm::ProgressStatus::Done { result } => match result {
                        core_client::stdcm::Response::Success {
                            simulation,
                            path,
                            departure_time,
                        } => {
                            span.record("path_found", true);
                            StdcmProgression::Completed(StdcmResponse::Success {
                                simulation: simulation.into(),
                                pathfinding_result: path,
                                departure_time,
                                core_payload: core_payload.clone(),
                            })
                        }
                        core_client::stdcm::Response::PathNotFound => {
                            span.record("path_found", false);
                            StdcmProgression::Completed(StdcmResponse::PathNotFound {
                                core_payload: core_payload.clone(),
                            })
                        }
                    },
                },
                Err(e) => StdcmProgression::Completed(StdcmResponse::InternalError {
                    error: e,
                    core_payload: core_payload.clone(),
                }),
            }
        });

        let mut result_stream = pin!(result_stream);
        while let Some(item) = result_stream.next().await {
            if tx.send(item).is_err() {
                break;
            }
        }
    };
    spawn(stream_result_lambda.in_current_span());
    let stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx);
    // Set `Content-Encoding` header to `identity` to not compress the payloads
    // This made the lmr live search progress display very laggy because the compression
    // layer compresses 8KB at a time which we do not wish to wait for (8KB of core intermediate
    // payloads is about 50 of them which is a lot to wait for)
    Ok((
        [(header::CONTENT_ENCODING, "identity")],
        StreamBodyAs::json_nl(stream),
    )
        .into_response())
}

struct VirtualTrainRun {
    simulation: simulation::Response,
}

impl VirtualTrainRun {
    #[allow(clippy::too_many_arguments)]
    async fn simulate_consists_sequence(
        db_pool: Arc<DbConnectionPoolV2>,
        valkey_client: Arc<cache::Client>,
        core_client: Arc<CoreClient>,
        app_version: Option<&str>,
        stdcm_request: &Request,
        infra: &Infra,
        consists_parameters: &[PhysicsConsistParameters],
    ) -> Result<Vec<Self>> {
        // Doesn't matter for now, but eventually it will affect tmp speed limits
        let approx_start_time = stdcm_request.get_earliest_step_time();
        let mut train_schedules = vec![];

        for ((start, end), consist_parameters) in itertools::chain!(
            std::iter::once(0),
            stdcm_request.consist_schedule.boundaries.clone(),
            std::iter::once(stdcm_request.steps.len() - 1)
        )
        .tuple_windows()
        .zip(consists_parameters.iter())
        {
            let path = convert_steps(&stdcm_request.steps[start..=end]);
            let last_step = path.last().expect("empty step list");

            train_schedules.push(TrainOccurrence {
                train_name: "".to_string(),
                labels: vec![],
                rolling_stock_name: consist_parameters.traction_engine.name.clone(),
                start_time: approx_start_time,
                schedule: vec![ScheduleItem {
                    // Make the train stop at the end
                    at: last_step.id.clone(),
                    arrival: None,
                    stop_for: Some(PositiveDuration::try_from(Duration::zero()).unwrap()),
                    reception_signal: ReceptionSignal::Open,
                }],
                margins: build_single_margin(stdcm_request.margin),
                initial_speed: 0.0,
                comfort: stdcm_request.comfort,
                path,
                constraint_distribution: Default::default(),
                speed_limit_tag: stdcm_request
                    .speed_limit_tags
                    .clone()
                    .map(schemas::primitives::NonBlankString::from),
                power_restrictions: vec![],
                options: Default::default(),
                category: None,
            });
        }

        // Compute simulation of a train schedule
        let simulations: Vec<Self> = consist_train_simulation_batch(
            &mut db_pool.get().await?,
            valkey_client,
            core_client,
            infra,
            &train_schedules,
            consists_parameters,
            None,
            app_version,
        )
        .await?
        .into_iter()
        .map(|(simulation, _)| Self {
            simulation: Arc::unwrap_or_clone(simulation),
        })
        .collect();

        if simulations.len() != train_schedules.len() {
            return Err(StdcmError::TrainSimulationFail.into());
        }

        Ok(simulations)
    }
}

/// Build a margins object with one margin value covering the entire range
fn build_single_margin(margin: Option<MarginValue>) -> Margins {
    match margin {
        None => Margins {
            boundaries: vec![],
            values: vec![],
        },
        Some(m) => Margins {
            boundaries: vec![],
            values: vec![m],
        },
    }
}

/// Convert a WorkSchedule to a core_client WorkSchedule
pub fn as_core_work_schedule(
    work_schedule: &WorkSchedule,
    earliest_departure_time: DateTime<Utc>,
    latest_simulation_end: DateTime<Utc>,
) -> Option<core_client::stdcm::WorkSchedule> {
    let search_window_duration =
        (latest_simulation_end - earliest_departure_time).num_milliseconds() as u64;

    let start_time =
        elapsed_time_since_ms(&work_schedule.start_date_time, &earliest_departure_time);
    let end_time = elapsed_time_since_ms(&work_schedule.end_date_time, &earliest_departure_time);

    if end_time == 0 || start_time >= search_window_duration {
        return None;
    }

    Some(core_client::stdcm::WorkSchedule {
        start_time,
        end_time,
        track_ranges: work_schedule
            .track_ranges
            .iter()
            .map(|track| UndirectedTrackRange {
                track_section: track.track.to_string(),
                begin: (track.begin * 1000.0).round() as u64,
                end: (track.end * 1000.0).round() as u64,
            })
            .collect(),
    })
}

fn elapsed_time_since_ms(time: &DateTime<Utc>, since: &DateTime<Utc>) -> u64 {
    max(0, (*time - since).num_milliseconds()) as u64
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use chrono::DateTime;
    use common::units;
    use core_client;
    use core_client::mocking::MockingClient;
    use core_client::pathfinding::TrainPath;
    use core_client::simulation::PhysicsConsist;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::fixtures::simple_rolling_stock;
    use schemas::fixtures::towed_rolling_stock;
    use schemas::rolling_stock::RollingResistance;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::OperationalPointPartReference;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::PathItemLocation;
    use std::str::FromStr;
    use uom::si::length::Length;
    use uom::si::length::meter;
    use uom::si::mass::kilogram;
    use uom::si::quantities::Mass;
    use uuid::Uuid;

    use crate::error::InternalError;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_rolling_stock_with_energy_sources;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::simulation_empty_response;
    use crate::views::timetable::stdcm::Request;
    use crate::views::timetable::stdcm::request::ConsistSchedule;
    use crate::views::timetable::stdcm::request::PathfindingItem;
    use crate::views::timetable::stdcm::request::StepTimingData;

    use super::*;

    fn get_stdcm_payload(
        rolling_stock_id: i64,
        work_schedule_group_id: Option<i64>,
        total_mass: Option<f64>,
        total_length: Option<f64>,
        consist_schedule: ConsistSchedule,
    ) -> Request {
        Request {
            start_time: Some(
                DateTime::from_str("2024-01-01T10:00:00Z").expect("Failed to parse datetime"),
            ),
            steps: vec![
                PathfindingItem {
                    duration: Some(0),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Trigram {
                                trigram: "WS".into(),
                                secondary_code: Some("BV".to_string()),
                            },
                            local_track_name: None,
                        },
                    ),
                    timing_data: Some(StepTimingData {
                        arrival_time: DateTime::from_str("2024-01-01T14:00:00Z")
                            .expect("Failed to parse datetime"),
                        arrival_time_tolerance_before: 0,
                        arrival_time_tolerance_after: 0,
                    }),
                },
                PathfindingItem {
                    duration: Some(0),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Trigram {
                                trigram: "MWS".into(),
                                secondary_code: Some("BV".to_string()),
                            },
                            local_track_name: None,
                        },
                    ),
                    timing_data: None,
                },
            ],
            rolling_stock_id,
            towed_rolling_stock_id: None,
            electrical_profile_set_id: None,
            work_schedule_group_id,
            temporary_speed_limit_group_id: None,
            comfort: Comfort::Standard,
            maximum_departure_delay: None,
            maximum_run_time: None,
            speed_limit_tags: Some("AR120".to_string()),
            time_gap_before: 35000,
            time_gap_after: 35000,
            margin: Some(MarginValue::MinPer100Km(4.5)),
            total_mass: total_mass.map(Mass::new::<kilogram>),
            total_length: total_length.map(Length::new::<meter>),
            max_speed: None,
            loading_gauge_type: None,
            allowed_track_sections: None,
            consist_schedule,
        }
    }

    fn build_consist_config(
        rolling_stock_id: i64,
        total_mass: Option<f64>,
    ) -> request::ConsistConfiguration {
        request::ConsistConfiguration {
            rolling_stock_id,
            towed_rolling_stock_id: None,
            total_mass: total_mass.map(Mass::new::<kilogram>),
            total_length: None,
            max_speed: None,
            speed_limit_tag: None,
            loading_gauge_type: None,
        }
    }

    fn build_step(trigram: &str) -> PathfindingItem {
        PathfindingItem {
            duration: Some(0),
            location: PathItemLocation::OperationalPointPartReference(
                schemas::train_schedule::OperationalPointPartReference {
                    operational_point:
                        schemas::train_schedule::OperationalPointReference::Trigram {
                            trigram: trigram.into(),
                            secondary_code: Some("BV".to_string()),
                        },
                    local_track_name: None,
                },
            ),
            timing_data: None,
        }
    }

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

    fn core_mocking_client() -> MockingClient {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_empty_response())
            .finish();
        core
    }

    #[test]
    fn simulation_with_towed_rolling_stock_parameters() {
        let mut rolling_stock = simple_rolling_stock();
        rolling_stock.mass = units::kilogram::new(100000.0);
        rolling_stock.length = units::meter::new(20.0);
        rolling_stock.inertia_coefficient = 1.10;
        rolling_stock.comfort_acceleration = units::meter_per_second_squared::new(0.1);
        rolling_stock.startup_acceleration = units::meter_per_second_squared::new(0.04);
        rolling_stock.rolling_resistance = RollingResistance {
            rolling_resistance_type: "davis".to_string(),
            A: units::newton::new(1.0),
            B: units::kilogram_per_second::new(0.01),
            C: units::kilogram_per_meter::new(0.0005),
        };

        let towed_rolling_stock = towed_rolling_stock();

        let total_mass = units::kilogram::new(200000.0);

        let simulation_parameters = PhysicsConsistParameters {
            total_length: None,
            max_speed: None,
            total_mass: Some(total_mass),
            towed_rolling_stock: Some(towed_rolling_stock.clone()),
            traction_engine: rolling_stock,
        };

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(physics_consist.mass, total_mass);

        assert_eq!(physics_consist.inertia_coefficient, 1.075);

        assert_eq!(
            physics_consist.rolling_resistance,
            RollingResistance {
                rolling_resistance_type: "davis".to_string(),
                A: units::newton::new(100001.0),
                B: units::kilogram_per_second::new(1000.01),
                C: units::kilogram_per_meter::new(20.0005),
            }
        );
    }

    #[test]
    fn simulation_with_parameters() {
        let simulation_parameters = PhysicsConsistParameters {
            total_mass: Some(units::kilogram::new(123.0)),
            total_length: Some(units::meter::new(455.0)),
            max_speed: Some(units::meter_per_second::new(10.0)),
            towed_rolling_stock: None,
            traction_engine: simple_rolling_stock(),
        };

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(physics_consist.mass, units::kilogram::new(123.0));
        assert_eq!(physics_consist.length, units::millimeter::new(455000.0)); // It should be converted in mm
        assert_eq!(
            physics_consist.max_speed,
            units::meter_per_second::new(10_f64)
        ); // It should be in m/s
    }

    #[test]
    fn simulation_without_parameters() {
        let rolling_stock = simple_rolling_stock();
        let simulation_parameters = PhysicsConsistParameters::from_traction_engine(rolling_stock);

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(physics_consist.mass, units::kilogram::new(15000.0));
        assert_eq!(physics_consist.length, units::millimeter::new(140000.)); // It should be converted in mm
        assert_eq!(
            physics_consist.max_speed,
            units::meter_per_second::new(20_f64)
        );
    }

    #[test]
    fn new_physics_rolling_stock_keeps_the_smallest_available_comfort_acceleration() {
        let mut rolling_stock = simple_rolling_stock();
        let mut towed_rolling_stock = towed_rolling_stock();
        rolling_stock.comfort_acceleration = units::meter_per_second_squared::new(0.2);
        towed_rolling_stock.comfort_acceleration = units::meter_per_second_squared::new(0.1);

        let mut simulation_parameters = PhysicsConsistParameters {
            max_speed: None,
            total_length: None,
            total_mass: None,
            towed_rolling_stock: Some(towed_rolling_stock.clone()),
            traction_engine: rolling_stock,
        };

        let physics_consist: PhysicsConsist = simulation_parameters.clone().into();

        assert_eq!(
            physics_consist.comfort_acceleration,
            units::meter_per_second_squared::new(0.1)
        );

        simulation_parameters.traction_engine.comfort_acceleration =
            units::meter_per_second_squared::new(0.2);
        towed_rolling_stock.comfort_acceleration = units::meter_per_second_squared::new(0.67);
        simulation_parameters.towed_rolling_stock = Some(towed_rolling_stock);

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(
            physics_consist.comfort_acceleration,
            units::meter_per_second_squared::new(0.2)
        );
    }

    #[test]
    fn new_physics_rolling_stock_keeps_the_biggest_available_startup_acceleration() {
        let mut simulation_parameters = PhysicsConsistParameters {
            max_speed: None,
            total_length: None,
            total_mass: None,
            towed_rolling_stock: Some(towed_rolling_stock()),
            traction_engine: simple_rolling_stock(),
        };

        simulation_parameters.traction_engine.startup_acceleration =
            units::meter_per_second_squared::new(0.3);
        if let Some(trs) = simulation_parameters.towed_rolling_stock.as_mut() {
            trs.startup_acceleration = units::meter_per_second_squared::new(0.45);
        }

        let physics_consist: PhysicsConsist = simulation_parameters.clone().into();

        assert_eq!(
            physics_consist.startup_acceleration,
            units::meter_per_second_squared::new(0.45)
        );

        if let Some(trs) = simulation_parameters.towed_rolling_stock.as_mut() {
            trs.startup_acceleration = units::meter_per_second_squared::new(0.4);
        }
        simulation_parameters.traction_engine.startup_acceleration =
            units::meter_per_second_squared::new(0.88);

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(
            physics_consist.startup_acceleration,
            units::meter_per_second_squared::new(0.88)
        );
    }

    #[test]
    fn new_physics_rolling_stock_keeps_the_smallest_available_max_speed() {
        let simulation_parameters = PhysicsConsistParameters {
            total_mass: None,
            total_length: None,
            max_speed: Some(units::meter_per_second::new(30.0)),
            towed_rolling_stock: None,
            traction_engine: simple_rolling_stock(),
        };

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(
            physics_consist.max_speed,
            units::meter_per_second::new(20_f64)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_return_success() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::Success {
                    simulation: simulation_empty_response().success().unwrap(),
                    path: pathfinding_result_success(),
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                },
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                None,
                None,
                ConsistSchedule::default(),
            ));

        let stdcm_response: StdcmProgression = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .last_jsonl_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(
                stdcm_response,
                StdcmProgression::Completed(StdcmResponse::Success {
                    simulation: simulation_empty_response().success().unwrap().into(),
                    pathfinding_result: path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                    core_payload: None,
                })
            );
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_request_mass_validation() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::Response::Success {
                simulation: simulation_empty_response().success().unwrap(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let total_mass = Some(80_000.0);
        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                total_mass,
                None,
                ConsistSchedule::default(),
            ));

        let stdcm_response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            stdcm_response.error_type,
            "editoast:stdcm:InvalidConsistMass".to_string()
        );
        assert_eq!(
            stdcm_response.context["expected_min"].as_f64(),
            Some(900000.0)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_request_length_validation() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::Response::Success {
                simulation: simulation_empty_response().success().unwrap(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let total_length = Some(300.0);
        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                None,
                total_length,
                ConsistSchedule::default(),
            ));

        let stdcm_response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            stdcm_response.error_type,
            "editoast:stdcm:InvalidConsistLength".to_string()
        );
        assert_eq!(stdcm_response.context["expected_min"].as_f64(), Some(400.0));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_request_validation_success() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::Success {
                    simulation: simulation_empty_response().success().unwrap(),
                    path: pathfinding_result_success(),
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                },
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let total_length = Some(410.0);
        let total_mass = Some(910_000.0);
        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                total_mass,
                total_length,
                ConsistSchedule::default(),
            ));

        let stdcm_response: StdcmProgression = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .last_jsonl_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(
                stdcm_response,
                StdcmProgression::Completed(StdcmResponse::Success {
                    simulation: simulation_empty_response().success().unwrap().into(),
                    pathfinding_result: path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                    core_payload: None,
                })
            );
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_fails() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::PathNotFound,
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                None,
                None,
                ConsistSchedule::default(),
            ));

        let stdcm_response: StdcmProgression = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .last_jsonl_into();

        assert_eq!(
            stdcm_response,
            StdcmProgression::Completed(StdcmResponse::PathNotFound { core_payload: None })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_multiple_response_return_success() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::InProgress {
                point: core_client::stdcm::ProgressCoordinates { lat: 0.0, lon: 0.0 },
                best_travel_time: 1,
            })
            .json(core_client::stdcm::ProgressStatus::InProgress {
                point: core_client::stdcm::ProgressCoordinates { lat: 1.0, lon: 1.0 },
                best_travel_time: 5,
            })
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::Success {
                    simulation: simulation_empty_response().success().unwrap(),
                    path: pathfinding_result_success(),
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                },
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                None,
                None,
                ConsistSchedule::default(),
            ));

        let stdcm_response: Vec<StdcmProgression> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .jsonl_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(stdcm_response.len(), 3);
            assert_eq!(
                stdcm_response[0].clone(),
                StdcmProgression::Ongoing(StdcmProgressionEvent {
                    point: Geometry::new(Value::Point(vec![0.0, 0.0])),
                    best_travel_time: 1,
                })
            );
            assert_eq!(
                stdcm_response[1].clone(),
                StdcmProgression::Ongoing(StdcmProgressionEvent {
                    point: Geometry::new(Value::Point(vec![1.0, 1.0])),
                    best_travel_time: 5,
                })
            );
            assert_eq!(
                stdcm_response[2].clone(),
                StdcmProgression::Completed(StdcmResponse::Success {
                    simulation: simulation_empty_response().success().unwrap().into(),
                    pathfinding_result: path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                    core_payload: None,
                })
            );
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_multiple_response_path_not_found() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::InProgress {
                point: core_client::stdcm::ProgressCoordinates { lat: 0.0, lon: 0.0 },
                best_travel_time: 1,
            })
            .json(core_client::stdcm::ProgressStatus::InProgress {
                point: core_client::stdcm::ProgressCoordinates { lat: 1.0, lon: 1.0 },
                best_travel_time: 5,
            })
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::PathNotFound,
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                None,
                None,
                None,
                ConsistSchedule::default(),
            ));

        let stdcm_response: Vec<StdcmProgression> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .jsonl_into();

        assert_eq!(stdcm_response.len(), 3);
        assert_eq!(
            stdcm_response[0].clone(),
            StdcmProgression::Ongoing(StdcmProgressionEvent {
                point: Geometry::new(Value::Point(vec![0.0, 0.0])),
                best_travel_time: 1,
            })
        );
        assert_eq!(
            stdcm_response[1].clone(),
            StdcmProgression::Ongoing(StdcmProgressionEvent {
                point: Geometry::new(Value::Point(vec![1.0, 1.0])),
                best_travel_time: 5,
            })
        );
        assert_eq!(
            stdcm_response[2].clone(),
            StdcmProgression::Completed(StdcmResponse::PathNotFound { core_payload: None })
        );
    }

    #[rstest]
    // A day before the 'start_time' -> FILTERED OUT
    #[case("2024-03-13 06:00:00Z", "2024-03-13 12:00:00Z", true)]
    // Finishing just after the 'start_time' -> KEPT
    #[case("2024-03-14 06:00:00Z", "2024-03-14 08:01:00Z", false)]
    // Starting after the 'latest_simulation_end' -> FILTERED OUT
    #[case("2024-03-14 10:01:00Z", "2024-03-14 12:00:00Z", true)]
    // Starting before the 'latest_simulation_end' -> KEPT
    #[case("2024-03-14 09:59:00Z", "2024-03-14 12:00:00Z", false)]
    // Starting before the 'start_time' and finishing after 'latest_simulation_end' -> KEPT
    #[case("2024-03-14 06:00:00Z", "2024-03-14 12:00:00Z", false)]
    // Starting after the 'start_time' and finishing before 'latest_simulation_end' -> KEPT
    #[case("2024-03-14 08:30:00Z", "2024-03-14 09:30:00Z", false)]
    fn filter_stdcm_work_schedules_with_window(
        #[case] ws_start_time: &str,
        #[case] ws_end_time: &str,
        #[case] filtered_out: bool,
    ) {
        // GIVEN

        use editoast_models::WorkSchedule;
        let work_schedules = [WorkSchedule {
            id: rand::random::<i64>(),
            start_date_time: DateTime::parse_from_rfc3339(ws_start_time)
                .unwrap()
                .to_utc(),
            end_date_time: DateTime::parse_from_rfc3339(ws_end_time).unwrap().to_utc(),
            ..Default::default()
        }];
        let start_time = DateTime::parse_from_rfc3339("2024-03-14T08:00:00Z")
            .unwrap()
            .to_utc();
        let latest_simulation_end = DateTime::parse_from_rfc3339("2024-03-14T10:00:00Z")
            .unwrap()
            .to_utc();

        // WHEN
        let filtered: Vec<_> = work_schedules
            .iter()
            .filter_map(|ws| as_core_work_schedule(ws, start_time, latest_simulation_end))
            .collect();

        // THEN
        assert!(filtered.is_empty() == filtered_out);
    }

    #[test]
    fn consist_schedule_reject_same_len_values_and_boundaries() {
        let req = get_stdcm_payload(
            1,
            None,
            None,
            None,
            ConsistSchedule {
                boundaries: vec![1, 2],
                values: vec![build_consist_config(1, None), build_consist_config(2, None)],
            },
        );

        let json = serde_json::to_string(&req).unwrap();
        let result = serde_json::from_str::<Request>(&json);
        assert!(result.is_err());
    }

    #[test]
    fn consist_schedule_reject_has_boundary_zero() {
        let req = get_stdcm_payload(
            1,
            None,
            None,
            None,
            ConsistSchedule {
                boundaries: vec![0],
                values: vec![build_consist_config(1, None), build_consist_config(2, None)],
            },
        );

        let json = serde_json::to_string(&req).unwrap();
        let result = serde_json::from_str::<Request>(&json);
        assert!(result.is_err());
    }

    #[test]
    fn consist_schedule_reject_has_boundary_last_step() {
        let req = get_stdcm_payload(
            1,
            None,
            None,
            None,
            ConsistSchedule {
                boundaries: vec![2],
                values: vec![build_consist_config(1, None), build_consist_config(2, None)],
            },
        );

        let json = serde_json::to_string(&req).unwrap();
        let result = serde_json::from_str::<Request>(&json);
        assert!(result.is_err());
    }

    #[test]
    fn consist_schedule_reject_decreasing_boundaries() {
        let req = get_stdcm_payload(
            1,
            None,
            None,
            None,
            ConsistSchedule {
                boundaries: vec![5, 3],
                values: vec![
                    build_consist_config(1, None),
                    build_consist_config(2, None),
                    build_consist_config(3, None),
                ],
            },
        );

        let json = serde_json::to_string(&req).unwrap();
        let result = serde_json::from_str::<Request>(&json);
        assert!(result.is_err());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_with_two_consists_with_different_total_mass() {
        let mut core = core_mocking_client();
        // Repeat the stubs for the 2 requests for the 2 consists
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_empty_response())
            .finish();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::Success {
                    simulation: simulation_empty_response().success().unwrap(),
                    path: pathfinding_result_success(),
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                },
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let first_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let second_rolling_stock = create_rolling_stock_with_energy_sources(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
        )
        .await;

        let total_mass_first_rolling_stock = Some(900_000.0);
        let total_mass_second_rolling_stock = Some(50_000.0);

        let mut payload = get_stdcm_payload(
            first_rolling_stock.id,
            None,
            None,
            None,
            ConsistSchedule {
                boundaries: vec![1],
                values: vec![
                    build_consist_config(first_rolling_stock.id, total_mass_first_rolling_stock),
                    build_consist_config(second_rolling_stock.id, total_mass_second_rolling_stock),
                ],
            },
        );

        payload.steps.push(build_step("SS"));

        // Three Stations [ "WS", "MWS", "SS" ]
        // WS -> MWS
        // Consist change
        // MWS -> SS

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&payload);

        let stdcm_response: StdcmProgression = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .last_jsonl_into();

        assert_eq!(
            stdcm_response,
            StdcmProgression::Completed(StdcmResponse::Success {
                simulation: simulation_empty_response().success().unwrap().into(),
                pathfinding_result: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
                core_payload: None,
            })
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_with_multiple_consists() {
        let mut core = core_mocking_client();
        // Repeat the stubs for all the 3 requests for the 3 consists
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_empty_response())
            .finish();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_empty_response())
            .finish();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(core_client::stdcm::ProgressStatus::Done {
                result: core_client::stdcm::Response::Success {
                    simulation: simulation_empty_response().success().unwrap(),
                    path: pathfinding_result_success(),
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                },
            })
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let first_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let second_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let third_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let mut payload = get_stdcm_payload(
            first_rolling_stock.id,
            None,
            None,
            None,
            ConsistSchedule {
                boundaries: vec![1, 2],
                values: vec![
                    build_consist_config(first_rolling_stock.id, None),
                    build_consist_config(second_rolling_stock.id, None),
                    build_consist_config(third_rolling_stock.id, None),
                ],
            },
        );

        payload.steps.push(build_step("MES"));
        payload.steps.push(build_step("SES"));

        // Four Stations [ "WS", "MWS", "MES", "SES" ]
        // WS -> WMS
        // Consist change
        // WNS -> MES
        // Consist change
        // MES -> SES

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&payload);

        let stdcm_response: StdcmProgression = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .last_jsonl_into();

        assert_eq!(
            stdcm_response,
            StdcmProgression::Completed(StdcmResponse::Success {
                simulation: simulation_empty_response().success().unwrap().into(),
                pathfinding_result: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
                core_payload: None,
            })
        );
    }
}
