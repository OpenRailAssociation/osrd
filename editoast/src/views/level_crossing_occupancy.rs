use crate::AppState;
use crate::authentication;
use crate::authorizers::SystemAuthorizer;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::path::projection::PathProjection;
use crate::views::projection::interpolate_arrival_time;
use crate::views::rolling_stock::RollingStockError;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::simulation::train_simulation_ordered_batch;
use authz::v2;
use editoast_models::Infra;
use editoast_models::LevelCrossingModel;
use editoast_models::Timetable;
use editoast_models::TrainSchedule;
use editoast_models::train_schedule::OccurrenceId;

use authz::RollingStockPrivilege;
use authz::v2::Authorizer as _;
use authz::v2::ResourcesList;
use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use chrono::Duration;
use common::units::millisecond;
use common::units::quantities::Offset;
use core_client::pathfinding::TrackRange;
use core_client::simulation::ReportTrain;
use editoast_derive::EditoastError;
use editoast_models::TrainScheduleException;
use editoast_models::prelude::*;
use editoast_models::rolling_stock::RollingStock;
use itertools::Itertools;
use schemas::TrainOccurrence;
use schemas::infra::Direction;
use schemas::infra::LevelCrossing;
use schemas::infra::TrackOffset;
use schemas::primitives::Identifier;
use schemas::primitives::TimeWindow;
use schemas::timetable_type::TimetableType;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use thiserror::Error;
use utoipa::ToSchema;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "level_crossing")]
enum LevelCrossingError {
    #[error("{count} level crossing(s) could not be found")]
    #[editoast_error(status = 404)]
    LevelCrossingBatchNotFound { count: usize },
    #[error("{count} train(s) could not be found")]
    #[editoast_error(status = 404)]
    TrainBatchNotFound { count: usize },
    #[error("Infra '{infra_id}' could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error("Timetable '{timetable_id}' could not be found")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Hourly timetables are not supported")]
    #[editoast_error(status = 422)]
    UnsupportedTimetableType,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct LevelCrossingOccupancyForm {
    train_ids: Vec<i64>,
    level_crossing_ids: Vec<Identifier>,
    infra_id: i64,
    timetable_id: i64,
    electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
pub(in crate::views) struct LevelCrossingOccupancy {
    #[serde(flatten)]
    #[schema(inline)]
    occurrence_id: OccurrenceId,
    #[serde(flatten)]
    #[schema(inline)]
    time_window: TimeWindow,
    direction: Direction,
}

/// Get the occupancy of a set of level crossings for a set of trains
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "level_crossing",
    request_body = inline(LevelCrossingOccupancyForm),
    responses(
        (status = 200, description = "Occupancy periods of the given level crossings", body = inline(HashMap<Identifier, Vec<LevelCrossingOccupancy>>)),
    ),
)]
pub(in crate::views) async fn occupancy(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client,
        regulator,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(LevelCrossingOccupancyForm {
        train_ids,
        level_crossing_ids,
        infra_id,
        timetable_id,
        electrical_profile_set_id,
    }): Json<LevelCrossingOccupancyForm>,
) -> Result<Json<HashMap<Identifier, Vec<LevelCrossingOccupancy>>>> {
    if let authentication::State::Authenticated { user, .. } = &authn_state {
        v2::infra_privileges(*user, authz::Infra(infra_id))
            .map(async |privileges| privileges.contains(&authz::InfraPrivilege::CanRestrictedRead))
            .ok_or(AuthorizationError::Forbidden)
            .run::<AuthorizationError, _>(&authn_state.authorizer(regulator.openfga()))
            .await??;
    }

    let conn = &mut db_pool.get().await?;

    // Check timetable type
    let timetable = Timetable::retrieve_or_fail(conn.clone(), timetable_id, || {
        LevelCrossingError::TimetableNotFound { timetable_id }
    })
    .await?;
    if timetable.timetable_type.0 == TimetableType::Hourly {
        return Err(LevelCrossingError::UnsupportedTimetableType.into());
    }

    // Load infra + level_crossings + trains
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        LevelCrossingError::InfraNotFound { infra_id }
    })
    .await?;

    let level_crossing_keys = level_crossing_ids
        .into_iter()
        .map(|obj_id| (infra_id, obj_id.to_string()));

    let level_crossings: Vec<LevelCrossingModel> =
        LevelCrossingModel::retrieve_batch_or_fail(conn, level_crossing_keys, |missing| {
            LevelCrossingError::LevelCrossingBatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    let mut exceptions = TrainScheduleException::retrieve_exceptions_by_train_schedules(
        conn,
        timetable_id,
        &train_ids,
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.train_schedule_id);

    let trains: Vec<TrainSchedule> =
        TrainSchedule::retrieve_batch_or_fail(conn, train_ids, |missing| {
            LevelCrossingError::TrainBatchNotFound {
                count: missing.len(),
            }
        })
        .await?;

    // Collect all occurrences from all trains, grouped by the rolling stock name of their train
    let train_occurrences = trains
        .iter()
        .flat_map(|train| {
            let train_exceptions = exceptions.remove(&train.id).unwrap_or_default();
            train
                .iter_occurrences(&train_exceptions)
                .map(|occurrence| (train.rolling_stock_name.clone(), occurrence))
                .collect_vec()
        })
        .into_group_map();

    let rolling_stock_names: HashSet<_> = train_occurrences.keys().cloned().collect();
    let rolling_stocks: Vec<_> = RollingStock::retrieve_batch_unchecked(conn, rolling_stock_names)
        .await
        .map_err(RollingStockError::from)?;

    let train_occurrences = filter_readable_occurrences(
        train_occurrences,
        &rolling_stocks,
        &authn_state,
        regulator.openfga(),
    )
    .await?;

    // Extract train schedules for simulation
    let train_schedules = train_occurrences
        .iter()
        .map(|(_, train_schedule)| train_schedule.clone())
        .collect_vec();

    let simulations_result = train_simulation_ordered_batch(
        conn,
        valkey_client,
        core_client,
        &train_schedules,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?;

    let rolling_stock_lengths: HashMap<_, _> = rolling_stocks
        .into_iter()
        .map(|rs| (rs.name, common::units::millimeter::from(rs.length) as u64))
        .collect();

    // For each occurrence + simulation result, compute level crossing occupancy and group by level crossing id
    let mut results: HashMap<Identifier, Vec<LevelCrossingOccupancy>> = HashMap::new();

    let train_occurrences_with_rollingstock = train_occurrences
        .into_iter()
        .zip(simulations_result)
        .filter_map(
            |((occurrence_id, train_schedule), (simulation, pathfinding))| {
                rolling_stock_lengths
                    .get(&train_schedule.rolling_stock_name)
                    .zip(Some((
                        occurrence_id,
                        train_schedule,
                        simulation,
                        pathfinding,
                    )))
            },
        )
        .collect_vec();

    for level_crossing in level_crossings {
        let level_crossing_occupancies = results.entry(level_crossing.obj_id.into()).or_default();
        for (rolling_stock_length, (occurrence_id, train_schedule, simulation, pathfinding)) in
            &train_occurrences_with_rollingstock
        {
            if let Some(occupancy) = find_level_crossing_occupancy(
                &level_crossing.schema,
                occurrence_id,
                simulation,
                pathfinding,
                train_schedule.start_time,
                rolling_stock_length,
            ) {
                level_crossing_occupancies.push(occupancy);
            }
        }
    }

    Ok(Json(results))
}

/// Discards the occurrences whose rolling stock the user isn't allowed to read
async fn filter_readable_occurrences(
    train_occurrences: HashMap<String, Vec<(OccurrenceId, TrainOccurrence)>>,
    rolling_stocks: &[RollingStock],
    authn_state: &crate::authentication::State,
    openfga: &fga::Client,
) -> Result<Vec<(OccurrenceId, TrainOccurrence)>> {
    // The request bypasses authorization
    let Some(user) = authn_state.user() else {
        return Ok(train_occurrences.into_values().flatten().collect());
    };

    // Listing the readable rolling stocks cannot be rejected: the issuer is already authenticated
    let Ok(authorized_rolling_stocks) = SystemAuthorizer::new_infallible(openfga)
        .authorize(authz::v2::rolling_stock_list(
            user,
            RollingStockPrivilege::CanRead,
        ))
        .await?
        .access()
        .await?;

    let ResourcesList::Privileged(authorized_rolling_stocks) = authorized_rolling_stocks else {
        // The user is an admin: every rolling stock is readable
        return Ok(train_occurrences.into_values().flatten().collect());
    };
    let authorized_rolling_stock_ids = authorized_rolling_stocks
        .into_iter()
        .map(|rolling_stock| rolling_stock.0)
        .collect::<HashSet<_>>();

    // Occurrences are grouped by rolling stock name, the authorization by id

    let authorized_rolling_stock_names = rolling_stocks
        .iter()
        .filter(|rs| authorized_rolling_stock_ids.contains(&rs.id))
        .map(|rs| rs.name.clone())
        .collect::<HashSet<_>>();

    Ok(train_occurrences
        .into_iter()
        .filter(|(rolling_stock_name, _)| {
            authorized_rolling_stock_names.contains(rolling_stock_name)
        })
        .flat_map(|(_, occurrences)| occurrences)
        .collect())
}

fn find_level_crossing_occupancy(
    level_crossing: &LevelCrossing,
    occurrence_id: &OccurrenceId,
    simulation: &simulation::Response,
    pathfinding: &PathfindingResult,
    start_time: Offset,
    rolling_stock_length: &u64,
) -> Option<LevelCrossingOccupancy> {
    // Check simulation results
    let (report_train, pathfinding_success) = match (simulation, pathfinding) {
        (
            simulation::Response::Success(SimulationResponseSuccess { final_output, .. }),
            PathfindingResult::Success(pathfinding_success),
        ) => (&final_output.report_train, pathfinding_success),
        _ => return None,
    };

    // Search for an intersection with the level crossing
    let (lc_position, matched_track_offset) = find_level_crossing_intersection(
        level_crossing,
        &pathfinding_success.path.track_section_ranges,
    )?;

    // Get the direction of the train on the track section
    let direction = pathfinding_success
        .path
        .track_section_ranges
        .iter()
        .find_map(|tr| (tr.track_section == matched_track_offset.track).then_some(tr.direction))
        .expect("Track range should exist since position was found");

    // Compute the occupancy time window
    let time_window = find_occupancy_time_window(
        &direction,
        report_train,
        level_crossing,
        &lc_position,
        &matched_track_offset,
        start_time,
        rolling_stock_length,
    )?;

    Some(LevelCrossingOccupancy {
        occurrence_id: occurrence_id.clone(),
        time_window,
        direction,
    })
}

fn find_level_crossing_intersection(
    level_crossing: &LevelCrossing,
    track_section_ranges: &Vec<TrackRange>,
) -> Option<(u64, TrackOffset)> {
    let lc_track_offsets = level_crossing.track_offset();

    let path_projection = PathProjection::new(track_section_ranges);

    lc_track_offsets.iter().find_map(|track_offset| {
        path_projection
            .get_position(track_offset)
            .map(|position| (position, track_offset.clone()))
    })
}

fn find_occupancy_time_window(
    direction: &Direction,
    report_train: &ReportTrain,
    level_crossing: &LevelCrossing,
    lc_position: &u64,
    matched_track_offset: &TrackOffset,
    start_time: Offset,
    rolling_stock_length: &u64,
) -> Option<TimeWindow> {
    let pedal_position =
        find_pedal_position(direction, lc_position, level_crossing, matched_track_offset)?;

    // Compute arrival and leaving times
    let lc_end_position = lc_position + level_crossing.short_zone_length + rolling_stock_length;
    let last_train_position = *report_train.positions.last()?;

    // Check whether the train completely leaves the short zone; ignore it otherwise.
    if lc_end_position > last_train_position {
        return None;
    }

    let arrival_time = interpolate_arrival_time(pedal_position, report_train);
    let leaving_time = interpolate_arrival_time(lc_end_position, report_train);

    Some(TimeWindow {
        time_begin: start_time + millisecond::i64::new(arrival_time),
        duration: Duration::milliseconds(leaving_time - arrival_time)
            .try_into()
            .expect("leaving_time should be greater than arrival_time"),
    })
}

fn find_pedal_position(
    direction: &Direction,
    lc_position: &u64,
    level_crossing: &LevelCrossing,
    matched_track_offset: &TrackOffset,
) -> Option<u64> {
    let lc_part = level_crossing
        .parts
        .iter()
        .find(|part| part.track == matched_track_offset.track)
        .expect("Part should exist since position was found");

    let pedal_offset = match direction {
        Direction::StartToStop => lc_part.pedal_upstream,
        Direction::StopToStart => lc_part.pedal_downstream,
    };
    lc_position.checked_sub(pedal_offset)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::create_fast_rolling_stock;
    use crate::fixtures::create_small_infra;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt as _;
    use crate::views::test_app::test_app;

    use authz::InfraGrant;
    use authz::Role;
    use authz::RollingStockGrant;
    use chrono::TimeDelta;
    use core_client::mocking::MockingClient;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrainPath;
    use reqwest::StatusCode;
    use schemas::infra::LevelCrossingPart;
    use schemas::train_schedule::PathItem;

    #[test]
    fn test_find_level_crossing_intersection_found() {
        let level_crossing = LevelCrossing {
            id: "LC1".into(),
            name: "Test LC".to_string(),
            short_zone_length: 50000,
            parts: vec![schemas::infra::LevelCrossingPart {
                track: "TC1".into(),
                position: 750.0,
                pedal_upstream: 500000,
                pedal_downstream: 1000000,
            }],
        };

        let track_ranges = vec![core_client::pathfinding::TrackRange {
            track_section: "TC1".into(),
            begin: 50000,
            end: 1000000,
            direction: Direction::StartToStop,
        }];

        let result = find_level_crossing_intersection(&level_crossing, &track_ranges);

        assert!(result.is_some());

        let (position, track_offset) = result.unwrap();
        assert_eq!(position, 700000);
        assert_eq!(track_offset.track.0, "TC1");
        assert_eq!(track_offset.offset, 750000);
    }

    #[test]
    fn test_find_level_crossing_intersection_not_found() {
        let level_crossing = LevelCrossing {
            id: "LC1".into(),
            name: "Test LC".to_string(),
            short_zone_length: 50000,
            parts: vec![schemas::infra::LevelCrossingPart {
                track: "TC1".into(),
                position: 750.0,
                pedal_upstream: 500000,
                pedal_downstream: 1000000,
            }],
        };

        // Train path doesn't include TC1
        let track_ranges = vec![core_client::pathfinding::TrackRange {
            track_section: "TC1".into(),
            begin: 800000,
            end: 1000000,
            direction: Direction::StartToStop,
        }];

        let result = find_level_crossing_intersection(&level_crossing, &track_ranges);
        assert!(result.is_none());
    }

    fn pathfinding_result_success() -> PathfindingResultSuccess {
        PathfindingResultSuccess {
            path: TrainPath {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![
                    TrackRange::new("TC1", 550000, 1000000, Direction::StartToStop), // Mid_West_station
                    TrackRange::new("TD0", 0, 14000000, Direction::StartToStop), // Mid_East_station
                ],
            },
            length: 14450000,
            path_item_positions: vec![0, 14450000],
            backtrack_path_items: Some(vec![]),
        }
    }

    fn simulation_with_realistic_positions() -> simulation::Response {
        use crate::views::timetable::simulation::SimulationResponseSuccess;
        use core_client::simulation::CompleteReportTrain;
        use core_client::simulation::ElectricalProfiles;
        use core_client::simulation::ReportTrain;
        use core_client::simulation::SpeedLimitProperties;

        // Create realistic positions covering the entire path (0 to 14450000mm)
        let mut positions = vec![];
        let mut times = vec![];
        let mut speeds = vec![];

        let total_length = 14450000;
        let step = 100000;
        let time_step = 10;

        let mut pos = 0;
        let mut time = 0;
        while pos <= total_length {
            positions.push(pos);
            times.push(time);
            speeds.push(25.0);
            pos += step;
            time += time_step;
        }

        simulation::Response::Success(SimulationResponseSuccess {
            base: ReportTrain {
                positions: vec![],
                times: vec![],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![],
            },
            provisional: ReportTrain {
                positions: vec![],
                times: vec![],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![],
            },
            final_output: CompleteReportTrain {
                report_train: ReportTrain {
                    positions,
                    times,
                    speeds,
                    energy_consumption: 100.0,
                    path_item_times: vec![0, 1450],
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
        })
    }

    fn mocked_core() -> MockingClient {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(PathfindingResult::Success(pathfinding_result_success()))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_with_realistic_positions())
            .finish();
        core
    }

    /// Creates the infra, the rolling stock, the timetable, the level crossing and the train the
    /// occupancy tests run on, and returns the form querying them
    async fn create_occupancy_fixtures(
        app: &TestApp,
        lc_id: &str,
        track: &str,
        lc_position: f64,
    ) -> (LevelCrossingOccupancyForm, TrainSchedule, RollingStock) {
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "simulation_rolling_stock").await;
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

        // Create level crossing
        let level_crossing = LevelCrossingModel::default()
            .into_changeset()
            .obj_id(lc_id.to_string())
            .infra_id(small_infra.id)
            .schema(LevelCrossing {
                id: lc_id.into(),
                name: lc_id.into(),
                short_zone_length: 50000,
                parts: vec![LevelCrossingPart {
                    track: track.into(),
                    position: lc_position,
                    pedal_upstream: 100000,
                    pedal_downstream: 50000,
                }],
            })
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create level crossing");

        let train = create_train(app, train_schedule_set.id, &rolling_stock.name).await;

        let form = LevelCrossingOccupancyForm {
            train_ids: vec![train.id],
            level_crossing_ids: vec![level_crossing.obj_id.into()],
            infra_id: small_infra.id,
            timetable_id: timetable.id,
            electrical_profile_set_id: None,
        };
        (form, train, rolling_stock)
    }

    /// A train running from `Mid_West_station` to `Mid_East_station`, paced every 15 minutes
    /// over an hour
    async fn create_train(
        app: &TestApp,
        train_schedule_set_id: i64,
        rolling_stock_name: &str,
    ) -> TrainSchedule {
        TrainSchedule::default()
            .into_changeset()
            .train_schedule_set_id(train_schedule_set_id)
            .rolling_stock_name(rolling_stock_name.to_string())
            .path(vec![
                PathItem::new_operational_point("Mid_West_station"),
                PathItem::new_operational_point("Mid_East_station"),
            ])
            .interval(Some(TimeDelta::minutes(15)))
            .time_window(Some(TimeDelta::hours(1)))
            .create(&mut app.db_pool().get_ok())
            .await
            .expect("Failed to create train")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_level_crossing_occupancy_endpoint() {
        let app = test_app!().core_client(mocked_core().into()).build();
        let (form, train, rolling_stock) =
            create_occupancy_fixtures(&app, "LC_TC1", "TC1", 750.0).await;

        let user = app
            .user("authorized", "Authorized")
            .with_infra_grant(form.infra_id, InfraGrant::Reader)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let occupancies: HashMap<Identifier, Vec<LevelCrossingOccupancy>> = app
            .post("/level_crossing_occupancy")
            .json(&form)
            .by_user(&user.info)
            .await
            .assert_status_ok()
            .json();

        let level_crossing_obj_id = &form.level_crossing_ids[0];
        assert!(occupancies.contains_key(level_crossing_obj_id));
        let lc_occupancies = occupancies.get(level_crossing_obj_id).unwrap();
        assert_eq!(lc_occupancies.len(), 4);

        // Expected values:
        // - LC position on path: 750000mm - 550000mm (TC1 begin) = 200000mm
        // - Pedal position: 200000mm - 100000mm (pedal_upstream) = 100000mm
        // - At 100000mm in mock : time = 10ms
        // - LC end: 200000 + 50000 (short_zone) + 400000 (rolling_stock length) = 650000mm
        // - At 650000mm in mock: time = 65ms
        // - Duration: 65ms - 10ms = 55ms

        let occupancy = &lc_occupancies[0];
        assert_eq!(occupancy.direction, Direction::StartToStop);
        assert_eq!(
            occupancy.time_window.time_begin,
            train.start_time + millisecond::i64::new(10)
        );
        assert_eq!(occupancy.time_window.duration.num_milliseconds(), 55);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_level_crossing_occupancy_returns_empty() {
        // A level crossing at 750m on TX1, which is not on the train path
        let app = test_app!().core_client(mocked_core().into()).build();
        let (form, _, rolling_stock) =
            create_occupancy_fixtures(&app, "LC_TX1", "TX1", 750.0).await;

        let user = app
            .user("authorized", "Authorized")
            .with_infra_grant(form.infra_id, InfraGrant::Reader)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // WHEN
        let occupancies: HashMap<Identifier, Vec<LevelCrossingOccupancy>> = app
            .post("/level_crossing_occupancy")
            .json(&form)
            .by_user(&user.info)
            .await
            .assert_status_ok()
            .json();

        // The level crossing is reported, without any occupancy
        assert_eq!(
            occupancies.get(&form.level_crossing_ids[0]).unwrap(),
            &Vec::new()
        );
    }

    /// The trains whose rolling stock the user cannot read are filtered out of the response,
    /// instead of failing the whole request with a 403
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_level_crossing_occupancy_without_rolling_stock_permission() {
        // GIVEN
        let app = test_app!().core_client(mocked_core().into()).build();
        let (form, ..) = create_occupancy_fixtures(&app, "LC_TC1", "TC1", 750.0).await;

        // a user that has the role to reach the endpoint and a read grant on the infra,
        // but no read grant on the rolling stock of the train
        let user = app
            .user("unauthorized", "Unauthorized")
            .with_infra_grant(form.infra_id, InfraGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // WHEN
        let occupancies: HashMap<Identifier, Vec<LevelCrossingOccupancy>> = app
            .post("/level_crossing_occupancy")
            .json(&form)
            .by_user(&user.info)
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            occupancies.get(&form.level_crossing_ids[0]).unwrap(),
            &Vec::new()
        );
    }

    /// Among several trains, only the occurrences of those whose rolling stock the user can read
    /// are reported, the others are filtered out
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_level_crossing_occupancy_filters_out_unreadable_trains_only() {
        // GIVEN
        let app = test_app!().core_client(mocked_core().into()).build();
        let (mut form, readable_train, readable_rolling_stock) =
            create_occupancy_fixtures(&app, "LC_TC1", "TC1", 750.0).await;

        // a second train of the same timetable, running on another rolling stock
        let unreadable_rolling_stock =
            create_fast_rolling_stock(&mut app.db_pool().get_ok(), "unreadable_rolling_stock")
                .await;
        let unreadable_train = create_train(
            &app,
            readable_train.train_schedule_set_id,
            &unreadable_rolling_stock.name,
        )
        .await;
        form.train_ids.push(unreadable_train.id);

        // a user granted a read access on the rolling stock of the first train only
        let user = app
            .user("authorized", "Authorized")
            .with_infra_grant(form.infra_id, InfraGrant::Reader)
            .with_rolling_stock_grant(readable_rolling_stock.id, RollingStockGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // WHEN
        let occupancies: HashMap<Identifier, Vec<LevelCrossingOccupancy>> = app
            .post("/level_crossing_occupancy")
            .json(&form)
            .by_user(&user.info)
            .await
            .assert_status_ok()
            .json();

        // THEN the occurrences of the readable train are reported, and only those
        let reported_occurrences: HashSet<_> = occupancies
            .get(&form.level_crossing_ids[0])
            .expect("the level crossing should be reported")
            .iter()
            .map(|occupancy| occupancy.occurrence_id.clone())
            .collect();
        let readable_occurrences: HashSet<_> = (0..4)
            .map(|index| OccurrenceId::new_base(readable_train.id, index))
            .collect();
        assert_eq!(reported_occurrences, readable_occurrences);
    }
}
