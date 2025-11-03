pub(crate) mod request;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::InvalidPathItem;
use core_client::pathfinding::PathfindingResultSuccess;
use core_client::stdcm::Request as StdcmRequest;
use core_client::stdcm::UndirectedTrackRange;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use request::Request;
use request::convert_steps;
use schemas::primitives::PositiveDuration;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::Margins;
use schemas::train_schedule::ReceptionSignal;
use schemas::train_schedule::ScheduleItem;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::max;
use std::slice;
use std::sync::Arc;
use thiserror::Error;
use tracing::Span;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::models::timetable::Timetable;
use crate::models::train_schedule::TrainSchedule;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::timetable::PhysicsConsistParameters;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::consist_train_simulation_batch;
use editoast_models::WorkSchedule;
use editoast_models::prelude::*;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
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
}

#[derive(Debug, Error, EditoastError, Serialize, derive_more::From)]
#[editoast_error(base_id = "stdcm")]
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
        request = serde_json::to_string(&request)?,
        timetable_id = id,
        infra_id = query.infra,
        path_found,
    )
)]
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    request_body = inline(Request),
    params(
        ("id" = i64, Path, description = "timetable_id"),
        StdcmQueryParams,
    ),
    responses(
        (status = 200, body = inline(StdcmResponse), description = "The simulation result"),
    )
)]
pub(in crate::views) async fn stdcm(
    state: State<AppState>,
    extension: AuthenticationExt,
    Path(id): Path<i64>,
    Query(query): Query<StdcmQueryParams>,
    Json(request): Json<Request>,
) -> Result<Json<StdcmResponse>> {
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
) -> Result<Json<StdcmResponse>> {
    let authorized = auth
        .check_roles([authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;

    let timetable_id = id;
    let infra_id = query.infra;

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
    let rolling_stock =
        RollingStock::retrieve_or_fail(conn.clone(), request.rolling_stock_id, || {
            StdcmError::RollingStockNotFound {
                rolling_stock_id: request.rolling_stock_id,
            }
        })
        .await?
        .into();

    let towed_rolling_stock = request
        .get_towed_rolling_stock(&mut conn)
        .await?
        .map(From::from);

    request.validate_consist(&rolling_stock, &towed_rolling_stock)?;

    let physics_consist_parameters = PhysicsConsistParameters {
        max_speed: request.max_speed,
        total_length: request.total_length,
        total_mass: request.total_mass,
        towed_rolling_stock,
        traction_engine: rolling_stock,
    };

    // 4. Compute the earliest start time and maximum departure delay
    let virtual_train_run = VirtualTrainRun::simulate(
        db_pool.clone(),
        valkey_client.clone(),
        core_client.clone(),
        config.app_version.as_deref(),
        &request,
        &infra,
        &physics_consist_parameters,
        timetable_id,
    )
    .await?;

    // Only the success variant of the simulation response contains the simulation run time.
    let Some(simulation_run_time) = virtual_train_run.simulation.simulation_run_time() else {
        return Ok(Json(StdcmResponse::PreprocessingSimulationError {
            error: virtual_train_run.simulation,
            core_payload: None,
        }));
    };

    let earliest_departure_time = request.get_earliest_departure_time(simulation_run_time);
    let latest_simulation_end = request.get_latest_simulation_end(simulation_run_time);

    // 5. Build STDCM request
    let stdcm_request = StdcmRequest {
        infra: infra.id,
        expected_version: infra.version,
        timetable_id,
        rolling_stock_loading_gauge: request
            .loading_gauge_type
            .unwrap_or(physics_consist_parameters.traction_engine.loading_gauge),
        rolling_stock_supported_signaling_systems: physics_consist_parameters
            .traction_engine
            .supported_signaling_systems
            .clone(),
        physics_consist: physics_consist_parameters.into(),
        temporary_speed_limits: request
            .get_temporary_speed_limits(&mut conn, simulation_run_time)
            .await?,
        comfort: request.comfort,
        path_items: request.get_stdcm_path_items(&mut conn, infra_id).await?,
        start_time: earliest_departure_time,
        maximum_departure_delay: request.get_maximum_departure_delay(simulation_run_time),
        maximum_run_time: request.get_maximum_run_time(simulation_run_time),
        speed_limit_tag: request.speed_limit_tags.clone(),
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

    let stdcm_response: Result<core_client::stdcm::Response, InternalError> = stdcm_request
        .fetch(core_client.as_ref())
        .await
        .map_err(Into::into);

    // 6. Handle STDCM Core Response
    let span = Span::current();
    match stdcm_response? {
        core_client::stdcm::Response::Success {
            simulation,
            path,
            departure_time,
        } => {
            span.record("path_found", true);
            Ok(Json(StdcmResponse::Success {
                simulation: simulation.into(),
                pathfinding_result: path,
                departure_time,
                core_payload: returned_request.clone(),
            }))
        }
        core_client::stdcm::Response::PathNotFound => {
            span.record("path_found", false);
            Ok(Json(StdcmResponse::PathNotFound {
                core_payload: returned_request.clone(),
            }))
        }
    }
}

struct VirtualTrainRun {
    simulation: simulation::Response,
}

impl VirtualTrainRun {
    #[allow(clippy::too_many_arguments)]
    async fn simulate(
        db_pool: Arc<DbConnectionPoolV2>,
        valkey_client: Arc<cache::Client>,
        core_client: Arc<CoreClient>,
        app_version: Option<&str>,
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
            main_category: None,
            sub_category: None,
        };

        // Compute simulation of a train schedule
        let (simulation, _) = consist_train_simulation_batch(
            &mut db_pool.get().await?,
            valkey_client,
            core_client,
            infra,
            slice::from_ref(&train_schedule),
            slice::from_ref(consist_parameters),
            None,
            app_version,
        )
        .await?
        .pop()
        .ok_or(StdcmError::TrainSimulationFail)?;

        Ok(Self {
            simulation: Arc::unwrap_or_clone(simulation),
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
                begin: (track.begin * 1000.0) as u64,
                end: (track.end * 1000.0) as u64,
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
    use schemas::train_schedule::OperationalPointIdentifier;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::PathItemLocation;
    use serde_json::json;
    use std::str::FromStr;
    use uom::si::length::Length;
    use uom::si::length::meter;
    use uom::si::mass::kilogram;
    use uom::si::quantities::Mass;
    use uuid::Uuid;

    use crate::error::InternalError;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_timetable;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::simulation_empty_response;
    use crate::views::timetable::stdcm::Request;
    use crate::views::timetable::stdcm::request::PathfindingItem;
    use crate::views::timetable::stdcm::request::StepTimingData;

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

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(rolling_stock.id, None, None, None));

        let stdcm_response: StdcmResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(
                stdcm_response,
                StdcmResponse::Success {
                    simulation: simulation_empty_response().success().unwrap().into(),
                    pathfinding_result: path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                    core_payload: None,
                }
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
            .json(&get_stdcm_payload(rolling_stock.id, None, total_mass, None));

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

        let stdcm_response: StdcmResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        if let PathfindingResult::Success(path) =
            PathfindingResult::Success(pathfinding_result_success())
        {
            assert_eq!(
                stdcm_response,
                StdcmResponse::Success {
                    simulation: simulation_empty_response().success().unwrap().into(),
                    pathfinding_result: path,
                    departure_time: DateTime::from_str("2024-01-02T00:00:00Z")
                        .expect("Failed to parse datetime"),
                    core_payload: None,
                }
            );
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stdcm_fails() {
        let mut core = core_mocking_client();
        core.stub("/stdcm")
            .response(StatusCode::OK)
            .json(json!({"status": "path_not_found"}))
            .finish();

        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;

        let request = app
            .post(format!("/timetable/{}/stdcm?infra={}", timetable.id, small_infra.id).as_str())
            .json(&get_stdcm_payload(rolling_stock.id, None, None, None));

        let stdcm_response: StdcmResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(
            stdcm_response,
            StdcmResponse::PathNotFound { core_payload: None }
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
}
