use std::ops::DerefMut;
use std::sync::Arc;

use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use futures::future::OptionFuture;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::simulation::SignalProjectionRequest;
use crate::core::simulation::SignalUpdate;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error;
use crate::models::train_schedule::ElectrificationRange;
use crate::models::train_schedule::Mrsp;
use crate::models::train_schedule::SimulationPowerRestrictionRange;
use crate::models::Curve;
use crate::models::FullResultStops;
use crate::models::PathWaypoint;
use crate::models::Pathfinding;
use crate::models::PathfindingPayload;
use crate::models::ResultPosition;
use crate::models::ResultSpeed;
use crate::models::ResultStops;
use crate::models::ResultTrain;
use crate::models::Retrieve;
use crate::models::SimulationOutput;
use crate::models::SimulationOutputChangeset;
use crate::models::Slope;
use crate::models::TrainSchedule;
use crate::modelsv2::RollingStockModel;
use crate::views::pathfinding::make_track_map;
use crate::views::train_schedule::projection::Projection;
use crate::views::train_schedule::TrainScheduleError::UnsimulatedTrainSchedule;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::primitives::Identifier;

editoast_common::schemas! {
    SimulationReport,
    ReportTrain,
    GetCurvePoint,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SimulationReport {
    // TODO: check if there is better way to do that than using Option
    #[schema(value_type = i64)]
    pub id: Option<i64>,
    pub labels: Vec<String>,
    /// The id of the path used for projection
    pub path: i64,
    pub name: String,
    #[schema(min_items = 2)]
    pub vmax: Mrsp,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    pub base: ReportTrain,
    #[serde(skip_serializing_if = "std::option::Option::is_none")]
    pub eco: Option<ReportTrain>,
    #[schema(required)]
    pub speed_limit_tags: Option<String>,
    /// A list of ranges which should be contiguous and which describe the
    /// electrification on the path and if it is handled by the train
    #[schema(required)]
    pub electrification_ranges: Vec<ElectrificationRange>,
    /// The list of ranges where power restrictions are applied
    #[schema(required)]
    pub power_restriction_ranges: Vec<SimulationPowerRestrictionRange>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct ReportTrain {
    pub head_positions: Vec<Vec<GetCurvePoint>>,
    pub tail_positions: Vec<Vec<GetCurvePoint>>,
    pub speeds: Vec<ResultSpeed>,
    pub stops: Vec<FullResultStops>,
    pub route_aspects: Vec<SignalUpdate>,
    pub mechanical_energy_consumed: f64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct GetCurvePoint {
    time: f64,
    position: f64,
}

pub async fn create_simulation_report(
    infra_id: i64,
    train_schedule: TrainSchedule,
    projection: &Projection,
    projection_path_payload: &PathfindingPayload,
    simulation_output_cs: SimulationOutputChangeset,
    db_pool: Arc<DbConnectionPoolV2>,
    core: &CoreClient,
) -> error::Result<SimulationReport> {
    let train_path =
        Pathfinding::retrieve_conn(db_pool.get().await?.deref_mut(), train_schedule.path_id)
            .await?
            .expect("Train Schedule should have a path");
    let train_path_payload = train_path.payload;
    use crate::modelsv2::Retrieve;
    let rolling_stock = RollingStockModel::retrieve(
        db_pool.get().await?.deref_mut(),
        train_schedule.rolling_stock_id,
    )
    .await?
    .expect("Train Schedule should have a rolling stock");
    let train_length = rolling_stock.length;
    let departure_time = train_schedule.departure_time;

    let base = project_simulation_results(
        infra_id,
        simulation_output_cs.base_simulation.unwrap().0,
        &train_path_payload,
        projection,
        projection_path_payload,
        departure_time,
        train_length,
        core,
        db_pool.clone(),
    )
    .await?;
    let eco: OptionFuture<_> = simulation_output_cs
        .eco_simulation
        .flatten()
        .map(|eco| async {
            project_simulation_results(
                infra_id,
                eco.0,
                &train_path_payload,
                projection,
                projection_path_payload,
                departure_time,
                train_length,
                core,
                db_pool.clone(),
            )
            .await
        })
        .into();
    let eco = eco.await.transpose()?;

    Ok(SimulationReport {
        id: train_schedule.id,
        labels: train_schedule.labels.0.to_vec(),
        path: train_schedule.path_id,
        name: train_schedule.train_name,
        vmax: simulation_output_cs.mrsp.unwrap().0,
        slopes: train_path.slopes.0, // diesel_json does not support into inner
        curves: train_path.curves.0,
        base,
        eco,
        speed_limit_tags: train_schedule.speed_limit_tags,
        electrification_ranges: simulation_output_cs
            .electrification_ranges
            .map(|e| e.0)
            .unwrap_or_default(),
        power_restriction_ranges: simulation_output_cs
            .power_restriction_ranges
            .map(|p| p.0)
            .unwrap_or_default(),
    })
}

pub async fn fetch_simulation_output(
    train_schedule: &TrainSchedule,
    db_pool: Arc<DbConnectionPoolV2>,
) -> error::Result<SimulationOutput> {
    use crate::tables::simulation_output::dsl::*;
    let ts_id = train_schedule.id.unwrap();

    simulation_output
        .filter(train_schedule_id.eq(ts_id))
        .get_result(db_pool.get().await?.deref_mut())
        .await
        .map_err(|err| match err {
            diesel::result::Error::NotFound => UnsimulatedTrainSchedule {
                train_schedule_id: ts_id,
            }
            .into(),
            err => err.into(),
        })
}

#[allow(clippy::too_many_arguments)]
async fn project_simulation_results(
    infra_id: i64,
    simulation_result: ResultTrain,
    train_path_payload: &PathfindingPayload,
    projection: &Projection,
    projection_path_payload: &PathfindingPayload,
    departure_time: f64,
    train_length: f64,
    core: &CoreClient,
    db_pool: Arc<DbConnectionPoolV2>,
) -> error::Result<ReportTrain> {
    let arrival_time = simulation_result
        .head_positions
        .last()
        .expect("Train should have at least one position")
        .time
        + departure_time;
    let head_positions = project_head_positions(
        simulation_result.head_positions,
        projection,
        train_path_payload,
        departure_time,
    );
    let tail_positions = compute_tail_positions(&head_positions, train_length);
    let signal_sightings = simulation_result.signal_sightings;
    let zone_updates = simulation_result.zone_updates;
    let signal_projection_request = SignalProjectionRequest {
        infra: infra_id,
        train_path: projection_path_payload.into(),
        signal_sightings,
        zone_updates,
    };
    let signal_projection_response = signal_projection_request.fetch(core).await?;
    let signal_updates = project_signal_updates(
        signal_projection_response.signal_updates,
        departure_time,
        arrival_time,
    );
    let speeds = project_speeds(simulation_result.speeds, departure_time);
    let stops = project_stops(simulation_result.stops, departure_time);
    let stops = add_stops_additional_information(
        stops,
        infra_id,
        train_path_payload.path_waypoints.clone(),
        db_pool,
    )
    .await?;
    Ok(ReportTrain {
        head_positions,
        tail_positions,
        speeds,
        stops,
        route_aspects: signal_updates,
        mechanical_energy_consumed: simulation_result.mechanical_energy_consumed,
    })
}

async fn add_stops_additional_information(
    stops: Vec<ResultStops>,
    infra_id: i64,
    path_waypoints: Vec<PathWaypoint>,
    db_pool: Arc<DbConnectionPoolV2>,
) -> error::Result<Vec<FullResultStops>> {
    let track_sections_map = make_track_map(
        db_pool.get().await?.deref_mut(),
        infra_id,
        path_waypoints
            .iter()
            .map(|pw| pw.location.track_section.0.clone()),
    )
    .await?;
    let stops = stops
        .iter()
        .zip(path_waypoints.iter())
        .map(|(s, pw)| {
            match &track_sections_map
                .get(&pw.location.track_section.0)
                .unwrap()
                .extensions
                .sncf
            {
                Some(ext) => FullResultStops {
                    result_stops: ResultStops {
                        time: s.time,
                        position: s.position,
                        duration: s.duration,
                        ch: pw.ch.clone(),
                    },
                    id: pw.id.clone(),
                    name: pw.name.clone(),
                    line_code: Some(ext.line_code),
                    track_number: Some(ext.track_number),
                    line_name: Some(ext.line_name.to_string()),
                    track_name: Some(ext.track_name.to_string()),
                },
                None => FullResultStops {
                    result_stops: ResultStops {
                        time: s.time,
                        position: s.position,
                        duration: s.duration,
                        ch: pw.ch.clone(),
                    },
                    ..Default::default()
                },
            }
        })
        .collect();
    Ok(stops)
}

fn project_speeds(mut speeds: Vec<ResultSpeed>, departure_time: f64) -> Vec<ResultSpeed> {
    for speed in speeds.iter_mut() {
        speed.time += departure_time;
    }
    speeds
}

fn project_stops(mut stops: Vec<ResultStops>, departure_time: f64) -> Vec<ResultStops> {
    for stop in stops.iter_mut() {
        stop.time += departure_time;
    }
    stops
}

fn project_signal_updates(
    signal_updates: Vec<SignalUpdate>,
    departure_time: f64,
    arrival_time: f64,
) -> Vec<SignalUpdate> {
    let mut results = Vec::new();
    for update in signal_updates {
        results.push(SignalUpdate {
            signal_id: update.signal_id,
            time_start: update.time_start + departure_time,
            time_end: update
                .time_end
                .map(|t| t + departure_time)
                .or(Some(arrival_time)),
            position_start: update.position_start,
            position_end: update.position_end,
            color: update.color,
            blinking: update.blinking,
            aspect_label: update.aspect_label,
            track: update.track,
            track_offset: update.track_offset,
        })
    }
    results
}

fn interpolate_locations(
    loc_a: &ResultPosition,
    loc_b: &ResultPosition,
    path_position: f64,
) -> f64 {
    let diff_time = loc_b.time - loc_a.time;
    let diff_space = loc_b.path_offset - loc_a.path_offset;
    if diff_space == 0.0 {
        return loc_a.time;
    }
    let coef = diff_time / diff_space;
    loc_a.time + (path_position - loc_a.path_offset) * coef
}

fn project_head_positions(
    train_locations: Vec<ResultPosition>,
    projection: &Projection,
    train_path_payload: &PathfindingPayload,
    departure_time: f64,
) -> Vec<Vec<GetCurvePoint>> {
    let mut results = Vec::new();
    let mut loc_index = 0;
    let intersections = projection.intersect(train_path_payload);
    for path_range in intersections {
        let mut current_curve = Vec::new();
        let begin_loc = path_range.begin;
        // Skip points that don't intersect the range
        while train_locations[loc_index + 1].path_offset <= begin_loc.path_offset {
            loc_index += 1;
        }

        // Add begin point
        let begin_time = interpolate_locations(
            &train_locations[loc_index],
            &train_locations[loc_index + 1],
            begin_loc.path_offset,
        );

        let begin_position = projection.track_position(&begin_loc.track, begin_loc.offset);
        assert!(begin_position.is_some());
        current_curve.push(GetCurvePoint {
            position: begin_position.unwrap_or_else(|| panic!("No position for {:?}", begin_loc)),
            time: begin_time + departure_time,
        });

        // Add intermediate points
        let end_loc = path_range.end;
        while loc_index + 1 < train_locations.len()
            && train_locations[loc_index + 1].path_offset < end_loc.path_offset
        {
            loc_index += 1;
            let loc = &train_locations[loc_index];
            let position =
                projection.track_position(&Identifier(loc.track_section.clone()), loc.offset);
            current_curve.push(GetCurvePoint {
                position: position.unwrap_or_else(|| panic!("No position for {:?}", loc)),
                time: loc.time + departure_time,
            });
        }

        if loc_index + 1 < train_locations.len() {
            // Add end points
            let end_time = interpolate_locations(
                &train_locations[loc_index],
                &train_locations[loc_index + 1],
                end_loc.path_offset,
            );
            let end_position = projection.track_position(&end_loc.track, end_loc.offset);
            current_curve.push(GetCurvePoint {
                position: end_position.unwrap_or_else(|| panic!("No position for {:?}", end_loc)),
                time: end_time + departure_time,
            });
        }

        results.push(current_curve);
    }
    results
}

fn compute_tail_positions(
    head_positions: &Vec<Vec<GetCurvePoint>>,
    train_length: f64,
) -> Vec<Vec<GetCurvePoint>> {
    let mut results = Vec::new();
    for curve in head_positions {
        if curve.is_empty() {
            results.push(Vec::new());
            continue;
        }
        let ascending = curve[0].position < curve[curve.len() - 1].position;
        let first_pos = curve[0].position;
        let mut current_curve = Vec::new();
        if ascending {
            for point in curve {
                current_curve.push(GetCurvePoint {
                    position: f64::max(first_pos, point.position - train_length),
                    time: point.time,
                })
            }
        } else {
            for point in curve {
                current_curve.push(GetCurvePoint {
                    position: f64::min(first_pos, point.position + train_length),
                    time: point.time,
                })
            }
        }
        results.push(current_curve);
    }
    results
}
