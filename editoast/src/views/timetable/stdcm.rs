mod failure_handler;
pub(crate) mod request;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::primitives::PositiveDuration;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::ReceptionSignal;
use editoast_schemas::train_schedule::ScheduleItem;
use failure_handler::SimulationFailureHandler;
use opentelemetry::trace::TraceContextExt;
use opentelemetry::trace::TraceId;
use request::convert_steps;
use request::Request;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tracing::Instrument;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::core;
use crate::core::conflict_detection::TrainRequirements;
use crate::core::pathfinding::InvalidPathItem;
use crate::core::pathfinding::PathfindingResultSuccess;
use crate::core::simulation::PhysicsConsistParameters;
use crate::core::simulation::RoutingRequirement;
use crate::core::simulation::SimulationResponse;
use crate::core::simulation::SpacingRequirement;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::stdcm_log::StdcmLog;
use crate::models::stdcm_log::StdcmResponseOrError;
use crate::models::timetable::Timetable;
use crate::models::train_schedule::TrainSchedule;
use crate::models::Infra;
use crate::models::RollingStockModel;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::timetable::Conflict;
use crate::views::train_schedule::consist_train_simulation_batch;
use crate::views::train_schedule::train_simulation_batch;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use crate::ValkeyClient;

editoast_common::schemas! {
    request::schemas(),
}

crate::routes! {
    "/stdcm" => stdcm,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
enum StdcmResponse {
    Success {
        simulation: SimulationResponse,
        path: PathfindingResultSuccess,
        departure_time: DateTime<Utc>,
    },
    Conflicts {
        pathfinding_result: PathfindingResult,
        conflicts: Vec<Conflict>,
    },
    PreprocessingSimulationError {
        error: SimulationResponse,
    },
}

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "stdcm_v2")]
enum StdcmError {
    #[error("Infrastrcture {infra_id} does not exist")]
    InfraNotFound { infra_id: i64 },
    #[error("Timetable {timetable_id} does not exist")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Rolling stock {rolling_stock_id} does not exist")]
    RollingStockNotFound { rolling_stock_id: i64 },
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
    #[error("Invalid consist length {provided_consist_length}: it should be greater than {expected_min}")]
    InvalidConsistLength {
        provided_consist_length: f64,
        expected_min: f64,
    },
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
struct InfraIdQueryParam {
    infra: i64,
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
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    request_body = inline(Request),
    params(("infra" = i64, Query, description = "The infra id"),
        ("id" = i64, Path, description = "timetable_id"),
    ),
    responses(
        (status = 201, body = inline(StdcmResponse), description = "The simulation result"),
    )
)]
async fn stdcm(
    State(AppState {
        config,
        db_pool,
        valkey: valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(id): Path<i64>,
    Query(query): Query<InfraIdQueryParam>,
    Json(stdcm_request): Json<Request>,
) -> Result<Json<StdcmResponse>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let trace_id = tracing::Span::current()
        .context()
        .span()
        .span_context()
        .trace_id();

    let trace_id = Some(trace_id).filter(|trace_id| *trace_id != TraceId::INVALID);

    let mut conn = db_pool.get().await?;

    let timetable_id = id;
    let infra_id = query.infra;

    // 1.  Infra / Timetable / Trains / Simulation / Rolling Stock

    let infra = Infra::retrieve_or_fail(&mut conn, infra_id, || StdcmError::InfraNotFound {
        infra_id,
    })
    .await?;

    let rolling_stock =
        RollingStockModel::retrieve_or_fail(&mut conn, stdcm_request.rolling_stock_id, || {
            StdcmError::RollingStockNotFound {
                rolling_stock_id: stdcm_request.rolling_stock_id,
            }
        })
        .await?
        .into();

    let towed_rolling_stock = stdcm_request
        .get_towed_rolling_stock(&mut conn)
        .await?
        .map(From::from);

    stdcm_request.validate_consist(&rolling_stock, &towed_rolling_stock)?;

    let physics_consist_parameters = PhysicsConsistParameters {
        max_speed: stdcm_request.max_speed,
        total_length: stdcm_request.total_length,
        total_mass: stdcm_request.total_mass,
        towed_rolling_stock,
        traction_engine: rolling_stock,
    };

    // 2. Compute the earliest start time and maximum departure delay
    let virtual_train_run = VirtualTrainRun::simulate(
        db_pool.clone(),
        valkey_client.clone(),
        core_client.clone(),
        &stdcm_request,
        &infra,
        &physics_consist_parameters,
        timetable_id,
    )
    .await?;

    // Only the success variant of the simulation response contains the simulation run time.
    let Some(simulation_run_time) = virtual_train_run.simulation.simulation_run_time() else {
        return Ok(Json(StdcmResponse::PreprocessingSimulationError {
            error: virtual_train_run.simulation,
        }));
    };

    let earliest_departure_time = stdcm_request.get_earliest_departure_time(simulation_run_time);
    let latest_simulation_end = stdcm_request.get_latest_simulation_end(simulation_run_time);

    let timetable = Timetable::retrieve_or_fail(&mut conn, timetable_id, || {
        StdcmError::TimetableNotFound { timetable_id }
    })
    .await?;

    let train_schedules = timetable
        .schedules_in_time_window(&mut conn, earliest_departure_time, latest_simulation_end)
        .await?;

    // 3. Get scheduled train requirements
    let simulations: Vec<_> = train_simulation_batch(
        &mut conn,
        valkey_client.clone(),
        core_client.clone(),
        &train_schedules,
        &infra,
        stdcm_request.electrical_profile_set_id,
    )
    .await?
    .into_iter()
    .map(|(sim, _)| sim)
    .collect();

    let trains_requirements = build_train_requirements(
        train_schedules.clone(),
        simulations.clone(),
        earliest_departure_time,
        latest_simulation_end,
    );

    // 4. Retrieve work schedules
    let work_schedules = stdcm_request.get_work_schedules(&mut conn).await?;

    // 5. Build STDCM request
    let stdcm_request = crate::core::stdcm::Request {
        infra: infra.id,
        expected_version: infra.version.clone(),
        rolling_stock_loading_gauge: physics_consist_parameters.traction_engine.loading_gauge,
        rolling_stock_supported_signaling_systems: physics_consist_parameters
            .traction_engine
            .supported_signaling_systems
            .clone(),
        physics_consist: physics_consist_parameters.into(),
        temporary_speed_limits: stdcm_request
            .get_temporary_speed_limits(&mut conn, simulation_run_time)
            .await?,
        comfort: stdcm_request.comfort,
        path_items: stdcm_request
            .get_stdcm_path_items(&mut conn, infra_id)
            .await?,
        start_time: earliest_departure_time,
        trains_requirements,
        maximum_departure_delay: stdcm_request.get_maximum_departure_delay(simulation_run_time),
        maximum_run_time: stdcm_request.get_maximum_run_time(simulation_run_time),
        speed_limit_tag: stdcm_request.speed_limit_tags,
        time_gap_before: stdcm_request.time_gap_before,
        time_gap_after: stdcm_request.time_gap_after,
        margin: stdcm_request.margin,
        time_step: Some(2000),
        work_schedules: work_schedules
            .iter()
            .filter_map(|ws| {
                ws.as_core_work_schedule(earliest_departure_time, latest_simulation_end)
            })
            .collect(),
    };

    let stdcm_response: Result<core::stdcm::Response, InternalError> = stdcm_request
        .fetch(core_client.as_ref())
        .await
        .map_err(Into::into);

    // 6. Log STDCM request and response if logging is enabled
    if config.enable_stdcm_logging {
        let user_id = auth.user_id().unwrap_or_else(|e| {
            tracing::error!(
                error = %e,
                "Authorization failed. Unable to retrieve user ID."
            );
            None
        });

        let stdcm_response = match stdcm_response {
            Ok(ref response) => StdcmResponseOrError::Response(response.clone()),
            Err(ref error) => {
                let error: InternalError = error.clone();
                StdcmResponseOrError::RequestError(serde_json::to_value(error.clone()).unwrap_or(
                    serde_json::Value::String("Failed to serialize the error".into()),
                ))
            }
        };

        tokio::spawn(
            // We just don't await the creation of the log entry since we want
            // the endpoint to return as soon as possible, and because failing
            // to persist a log entry is not a very important error here.
            StdcmLog::log(
                conn,
                trace_id.map(|trace_id| trace_id.to_string()),
                stdcm_request,
                stdcm_response,
                user_id,
            )
            .in_current_span(),
        );
    }

    // 7. Handle STDCM Core Response
    match stdcm_response? {
        crate::core::stdcm::Response::Success {
            simulation,
            path,
            departure_time,
        } => Ok(Json(StdcmResponse::Success {
            simulation,
            path,
            departure_time,
        })),
        crate::core::stdcm::Response::PreprocessingSimulationError { error } => {
            Ok(Json(StdcmResponse::PreprocessingSimulationError { error }))
        }
        crate::core::stdcm::Response::PathNotFound => {
            let simulation_failure_handler = SimulationFailureHandler {
                core_client,
                infra_id,
                infra_version: infra.version,
                train_schedules,
                simulations,
                work_schedules,
                virtual_train_run,
                earliest_departure_time,
                latest_simulation_end,
            };
            let stdcm_response = simulation_failure_handler.compute_conflicts().await?;
            Ok(Json(stdcm_response))
        }
    }
}

/// Build the list of scheduled train requirements, only including requirements
/// that overlap with the possible simulation times.
fn build_train_requirements(
    train_schedules: Vec<TrainSchedule>,
    simulation_responses: Vec<SimulationResponse>,
    departure_time: DateTime<Utc>,
    latest_simulation_end: DateTime<Utc>,
) -> HashMap<String, TrainRequirements> {
    let mut trains_requirements = HashMap::new();
    for (train, sim) in train_schedules.iter().zip(simulation_responses) {
        let final_output = match sim {
            SimulationResponse::Success { final_output, .. } => final_output,
            _ => continue,
        };

        // First check that the train overlaps with the simulation range
        let start_time = train.start_time;
        let train_duration_ms = *final_output.report_train.times.last().unwrap_or(&0);
        if !is_resource_in_range(
            departure_time,
            latest_simulation_end,
            start_time,
            0,
            train_duration_ms,
        ) {
            continue;
        }

        let spacing_requirements: Vec<SpacingRequirement> = final_output
            .spacing_requirements
            .into_iter()
            .filter(|req| {
                is_resource_in_range(
                    departure_time,
                    latest_simulation_end,
                    start_time,
                    req.begin_time,
                    req.end_time,
                )
            })
            .collect();
        let routing_requirements: Vec<RoutingRequirement> = final_output
            .routing_requirements
            .into_iter()
            .filter(|req| {
                is_resource_in_range(
                    departure_time,
                    latest_simulation_end,
                    start_time,
                    req.begin_time,
                    req.zones
                        .iter()
                        .map(|zone_req| zone_req.end_time)
                        .max()
                        .unwrap_or(req.begin_time),
                )
            })
            .collect();
        trains_requirements.insert(
            train.id.to_string(),
            TrainRequirements {
                start_time,
                spacing_requirements,
                routing_requirements,
            },
        );
    }
    trains_requirements
}

/// Returns true if the resource use is at least partially in the simulation time range
fn is_resource_in_range(
    earliest_sim_time: DateTime<Utc>,
    latest_sim_time: DateTime<Utc>,
    train_start_time: DateTime<Utc>,
    resource_start_time: u64,
    resource_end_time: u64,
) -> bool {
    let abs_resource_start_time =
        train_start_time + Duration::milliseconds(resource_start_time as i64);
    let abs_resource_end_time = train_start_time + Duration::milliseconds(resource_end_time as i64);
    abs_resource_start_time <= latest_sim_time && abs_resource_end_time >= earliest_sim_time
}

struct VirtualTrainRun {
    train_schedule: TrainSchedule,
    simulation: SimulationResponse,
    pathfinding: PathfindingResult,
}

impl VirtualTrainRun {
    async fn simulate(
        db_pool: Arc<DbConnectionPoolV2>,
        valkey_client: Arc<ValkeyClient>,
        core_client: Arc<CoreClient>,
        stdcm_request: &Request,
        infra: &Infra,
        consist_parameters: &PhysicsConsistParameters,
        timetable_id: i64,
    ) -> Result<Self> {
        // Doesn't matter for now, but eventually it will affect tmp speed limits
        let approx_start_time = stdcm_request.get_earliest_step_time();

        let path = convert_steps(&stdcm_request.steps);
        let last_step = path.last().expect("empty step list");

        let train_schedule = TrainSchedule {
            id: 0,
            train_name: "".to_string(),
            labels: vec![],
            rolling_stock_name: consist_parameters.traction_engine.name.clone(),
            timetable_id,
            start_time: approx_start_time,
            schedule: vec![ScheduleItem {
                // Make the train stop at the end
                at: last_step.id.clone(),
                arrival: None,
                stop_for: Some(PositiveDuration::try_from(Duration::zero()).unwrap()),
                reception_signal: ReceptionSignal::Open,
                locked: false,
            }],
            margins: build_single_margin(stdcm_request.margin),
            initial_speed: 0.0,
            comfort: stdcm_request.comfort,
            path,
            constraint_distribution: Default::default(),
            speed_limit_tag: stdcm_request.speed_limit_tags.clone(),
            power_restrictions: vec![],
            options: Default::default(),
        };

        // Compute simulation of a train schedule
        let (simulation, pathfinding) = consist_train_simulation_batch(
            &mut db_pool.get().await?,
            valkey_client,
            core_client,
            infra,
            &[train_schedule.clone()],
            &[consist_parameters.clone()],
            None,
        )
        .await?
        .pop()
        .ok_or(StdcmError::TrainSimulationFail)?;

        Ok(Self {
            train_schedule,
            simulation,
            pathfinding,
        })
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

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use chrono::DateTime;
    use editoast_common::units;
    use editoast_models::DbConnectionPoolV2;
    use editoast_schemas::rolling_stock::RollingResistance;
    use editoast_schemas::train_schedule::Comfort;
    use editoast_schemas::train_schedule::OperationalPointIdentifier;
    use editoast_schemas::train_schedule::OperationalPointReference;
    use editoast_schemas::train_schedule::PathItemLocation;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::str::FromStr;
    use uom::si::length::meter;
    use uom::si::length::Length;
    use uom::si::mass::kilogram;
    use uom::si::quantities::Mass;
    use uuid::Uuid;

    use crate::core::conflict_detection::Conflict as CoreConflict;
    use crate::core::conflict_detection::ConflictDetectionResponse;
    use crate::core::conflict_detection::ConflictType;
    use crate::core::mocking::MockingClient;
    use crate::core::simulation::CompleteReportTrain;
    use crate::core::simulation::ElectricalProfiles;
    use crate::core::simulation::PhysicsConsist;
    use crate::core::simulation::ReportTrain;
    use crate::core::simulation::SpeedLimitProperties;
    use crate::error::InternalError;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_simple_rolling_stock;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::create_towed_rolling_stock;
    use crate::models::work_schedules::WorkSchedule;
    use crate::models::work_schedules::WorkScheduleGroup;
    use crate::models::work_schedules::WorkScheduleType;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::stdcm::request::PathfindingItem;
    use crate::views::timetable::stdcm::request::StepTimingData;
    use crate::views::timetable::stdcm::PathfindingResult;
    use crate::views::timetable::stdcm::Request;

    use super::*;

    fn get_stdcm_payload(
        rolling_stock_id: i64,
        work_schedule_group_id: Option<i64>,
        total_mass: Option<f64>,
        total_length: Option<f64>,
    ) -> Request {
        Request {
            start_time: Some(
                DateTime::from_str("2024-01-01T10:00:00Z").expect("Failed to parse datetime"),
            ),
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
                        arrival_time: DateTime::from_str("2024-01-01T14:00:00Z")
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
        }
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

    fn core_mocking_client() -> MockingClient {
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
        core
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

    #[test]
    fn simulation_with_towed_rolling_stock_parameters() {
        let mut rolling_stock = create_simple_rolling_stock();
        rolling_stock.mass = units::kilogram::new(100000.0);
        rolling_stock.length = units::meter::new(20.0);
        rolling_stock.inertia_coefficient = units::basis_point::new(1.10);
        rolling_stock.comfort_acceleration = units::meter_per_second_squared::new(0.1);
        rolling_stock.startup_acceleration = units::meter_per_second_squared::new(0.04);
        rolling_stock.rolling_resistance = RollingResistance {
            rolling_resistance_type: "davis".to_string(),
            A: units::newton::new(1.0),
            B: units::kilogram_per_second::new(0.01),
            C: units::kilogram_per_meter::new(0.0005),
        };

        let towed_rolling_stock = create_towed_rolling_stock();

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

        assert_eq!(
            physics_consist.inertia_coefficient,
            units::basis_point::new(1.075)
        );

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
            traction_engine: create_simple_rolling_stock(),
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
        let rolling_stock = create_simple_rolling_stock();
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
        let mut rolling_stock = create_simple_rolling_stock();
        let mut towed_rolling_stock = create_towed_rolling_stock();
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
            towed_rolling_stock: Some(create_towed_rolling_stock()),
            traction_engine: create_simple_rolling_stock(),
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
            traction_engine: create_simple_rolling_stock(),
        };

        let physics_consist: PhysicsConsist = simulation_parameters.into();

        assert_eq!(
            physics_consist.max_speed,
            units::meter_per_second::new(20_f64)
        );
    }

    fn get_conflict_data(train_ids: Vec<String>, work_schedule_ids: Vec<String>) -> CoreConflict {
        CoreConflict {
            train_ids,
            work_schedule_ids,
            start_time: DateTime::from_str("2024-01-01T06:00:00Z")
                .expect("Failed to parse datetime"),
            end_time: DateTime::from_str("2024-01-01T18:00:00Z").expect("Failed to parse datetime"),
            conflict_type: ConflictType::Spacing,
            requirements: vec![],
        }
    }

    fn get_conflict_response_data(
        train_schedule_ids: Vec<i64>,
        work_schedule_ids: Vec<i64>,
    ) -> Conflict {
        Conflict {
            train_schedule_ids,
            paced_train_occurrence_ids: vec![],
            work_schedule_ids,
            start_time: DateTime::from_str("2024-01-01T06:00:00Z")
                .expect("Failed to parse datetime"),
            end_time: DateTime::from_str("2024-01-01T18:00:00Z").expect("Failed to parse datetime"),
            conflict_type: ConflictType::Spacing,
            requirements: vec![],
        }
    }

    #[rstest]
    async fn stdcm_return_success() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(crate::core::stdcm::Response::Success {
                simulation: simulation_response(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(rolling_stock.id, None, None, None));

        let stdcm_response: StdcmResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(
                stdcm_response,
                StdcmResponse::Success {
                    simulation: simulation_response(),
                    path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime")
                }
            );
        }
    }

    #[rstest]
    async fn stdcm_request_mass_validation() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(crate::core::stdcm::Response::Success {
                simulation: simulation_response(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let total_mass = Some(80_000.0);
        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(rolling_stock.id, None, total_mass, None));

        let stdcm_response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            stdcm_response.error_type,
            "editoast:stdcm_v2:InvalidConsistMass".to_string()
        );
        assert_eq!(
            stdcm_response.context["expected_min"].as_f64(),
            Some(900000.0)
        );
    }

    #[rstest]
    async fn stdcm_request_length_validation() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(crate::core::stdcm::Response::Success {
                simulation: simulation_response(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
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
            ));

        let stdcm_response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            stdcm_response.error_type,
            "editoast:stdcm_v2:InvalidConsistLength".to_string()
        );
        assert_eq!(stdcm_response.context["expected_min"].as_f64(), Some(400.0));
    }

    #[rstest]
    async fn stdcm_request_validation_success() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(crate::core::stdcm::Response::Success {
                simulation: simulation_response(),
                path: pathfinding_result_success(),
                departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                    .expect("Failed to parse datetime"),
            })
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
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
            ));

        let stdcm_response: StdcmResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(
                stdcm_response,
                StdcmResponse::Success {
                    simulation: simulation_response(),
                    path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime")
                }
            );
        }
    }

    #[rstest]
    async fn stdcm_return_conflicts() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({"status": "path_not_found"}))
            .finish();
        core.stub("/v2/conflict_detection")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(ConflictDetectionResponse {
                conflicts: vec![get_conflict_data(
                    vec![0.to_string(), 1.to_string()],
                    vec![],
                )],
            })
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(rolling_stock.id, None, None, None));

        let stdcm_response: StdcmResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(
            stdcm_response,
            StdcmResponse::Conflicts {
                pathfinding_result: PathfindingResult::Success(pathfinding_result_success()),
                conflicts: vec![get_conflict_response_data(vec![1], vec![])],
            }
        );
    }

    #[rstest]
    async fn stdcm_return_work_schedule_conflicts() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let work_schedule_group = WorkScheduleGroup::changeset()
            .name("work_schedule_group_name_test".to_string())
            .creation_date(Utc::now())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create a new work schedule group");

        let work_schedule_changeset = WorkSchedule::changeset()
            .start_date_time(
                DateTime::from_str("2024-01-01T06:00:00Z").expect("Failed to parse datetime"),
            )
            .end_date_time(
                DateTime::from_str("2024-01-01T18:00:00Z").expect("Failed to parse datetime"),
            )
            .track_ranges(vec![])
            .obj_id("work_schedule_obj_id".to_string())
            .work_schedule_type(WorkScheduleType::Catenary)
            .work_schedule_group_id(work_schedule_group.id);

        let work_schedules: Vec<_> =
            WorkSchedule::create_batch(&mut db_pool.get_ok(), vec![work_schedule_changeset])
                .await
                .expect("Failed to create a new work schedule");
        let work_schedule_ids: Vec<String> = work_schedules
            .into_iter()
            .map(|ws| ws.id.to_string())
            .collect();

        let mut core = core_mocking_client();
        core.stub("/v2/stdcm")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(crate::core::stdcm::Response::PathNotFound)
            .finish();
        core.stub("/v2/conflict_detection")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(ConflictDetectionResponse {
                conflicts: vec![get_conflict_data(
                    vec![String::from("0")],
                    work_schedule_ids.clone(),
                )],
            })
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(
                rolling_stock.id,
                Some(work_schedule_group.id),
                None,
                None,
            ));

        let stdcm_response: StdcmResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(
            stdcm_response,
            StdcmResponse::Conflicts {
                pathfinding_result: PathfindingResult::Success(pathfinding_result_success()),
                conflicts: vec![get_conflict_response_data(
                    vec![],
                    work_schedule_ids
                        .iter()
                        .map(|ws| ws.parse::<i64>().unwrap_or_else(|_| panic!(
                            "Failed to parse work schedule id '{}'",
                            ws
                        )))
                        .collect()
                )],
            }
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

        use crate::models::work_schedules::WorkSchedule;
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
            .filter_map(|ws| ws.as_core_work_schedule(start_time, latest_simulation_end))
            .collect();

        // THEN
        assert!(filtered.is_empty() == filtered_out);
    }
}
