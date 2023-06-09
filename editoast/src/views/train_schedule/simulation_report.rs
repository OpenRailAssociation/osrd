use crate::core::simulation::{SignalProjectionRequest, SignalUpdate};
use crate::core::{AsCoreRequest, CoreClient};
use crate::models::{
    Curve, Pathfinding, PathfindingPayload, ResultPosition, ResultSpeed, ResultStops, ResultTrain,
    Retrieve, RollingStockModel, SimulationOutput, Slope, TrainSchedule,
};
use crate::schema::utils::Identifier;
use crate::{error, DbPool};
use actix_web::web::Data;
use geos::geojson::JsonValue;
use serde_derive::{Deserialize, Serialize};

use crate::views::train_schedule::projection::Projection;

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationReport {
    id: i64,
    labels: JsonValue,
    path: i64,
    name: String,
    vmax: JsonValue,
    slopes: Vec<Slope>,
    curves: Vec<Curve>,
    base: ReportTrain,
    eco: Option<ReportTrain>,
    speed_limit_tags: Option<String>,
    electrification_conditions: JsonValue,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportTrain {
    pub head_positions: Vec<Vec<GetCurvePoint>>,
    pub tail_positions: Vec<Vec<GetCurvePoint>>,
    pub speeds: Vec<ResultSpeed>,
    pub stops: Vec<ResultStops>,
    pub route_aspects: Vec<SignalUpdate>,
    pub mechanical_energy_consumed: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetCurvePoint {
    time: f64,
    position: f64,
}

pub async fn create_simulation_report(
    infra: i64,
    train_schedule: TrainSchedule,
    projection: &Projection,
    projection_path_payload: &PathfindingPayload,
    db_pool: Data<DbPool>,
    core: &CoreClient,
) -> error::Result<SimulationReport> {
    let mut conn = db_pool.get()?;
    let simulation_output = fetch_simulation_output(&train_schedule, &mut conn)?;
    let train_path = Pathfinding::retrieve(db_pool.clone(), train_schedule.path_id)
        .await?
        .expect("Train Schedule should have a path");
    let train_path_payload = train_path.payload;
    let rolling_stock =
        RollingStockModel::retrieve(db_pool.clone(), train_schedule.rolling_stock_id)
            .await?
            .expect("Train Schedule should have a rolling stock");
    let train_length = rolling_stock
        .length
        .expect("Rolling stock should have a length");
    let departure_time = train_schedule.departure_time;

    let base = project_simulation_results(
        infra,
        simulation_output.base_simulation.0,
        &train_path_payload,
        projection,
        projection_path_payload,
        departure_time,
        train_length,
        core,
    )
    .await?;

    let eco = if let Some(eco) = simulation_output.eco_simulation {
        Some(
            project_simulation_results(
                infra,
                eco.0,
                &train_path_payload,
                projection,
                projection_path_payload,
                departure_time,
                train_length,
                core,
            )
            .await?,
        )
    } else {
        None
    };

    Ok(SimulationReport {
        id: train_schedule.id.unwrap(),
        labels: train_schedule.labels,
        path: train_schedule.path_id,
        name: train_schedule.train_name,
        vmax: simulation_output.mrsp,
        slopes: (*train_path.slopes).clone(), // diesel_json does not support into inner
        curves: (*train_path.curves).clone(),
        base,
        eco,
        speed_limit_tags: train_schedule.speed_limit_tags,
        electrification_conditions: simulation_output.electrification_conditions,
    })
}

pub fn fetch_simulation_output(
    train_schedule: &TrainSchedule,
    conn: &mut diesel::PgConnection,
) -> error::Result<SimulationOutput> {
    use crate::tables::osrd_infra_simulationoutput::dsl::*;
    use crate::views::train_schedule::TrainScheduleError::UnsimulatedTrainSchedule;
    use diesel::prelude::*;
    match osrd_infra_simulationoutput
        .filter(train_schedule_id.eq(train_schedule.id.unwrap()))
        .get_result(conn)
    {
        Ok(scenario) => Ok(scenario),
        Err(diesel::result::Error::NotFound) => Err(UnsimulatedTrainSchedule {
            train_schedule_id: train_schedule.id.unwrap(),
        }
        .into()),
        Err(err) => Err(err.into()),
    }
}

#[allow(clippy::too_many_arguments)]
async fn project_simulation_results(
    infra: i64,
    simulation_result: ResultTrain,
    train_path_payload: &PathfindingPayload,
    projection: &Projection,
    projection_path_payload: &PathfindingPayload,
    departure_time: f64,
    train_length: f64,
    core: &CoreClient,
) -> error::Result<ReportTrain> {
    let arrival_time = simulation_result
        .head_positions
        .last()
        .expect("Train should have at least one position")
        .time;
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
        infra: infra.to_string(),
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
    Ok(ReportTrain {
        head_positions,
        tail_positions,
        speeds,
        stops,
        route_aspects: signal_updates,
        mechanical_energy_consumed: simulation_result.mechanical_energy_consumed,
    })
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
        // Skip points that doesn't intersect the range
        while train_locations[loc_index + 1].path_offset < begin_loc.path_offset {
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
            position: begin_position.unwrap(),
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
            assert!(position.is_some());
            current_curve.push(GetCurvePoint {
                position: position.unwrap(),
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
            assert!(end_position.is_some());
            current_curve.push(GetCurvePoint {
                position: end_position.unwrap(),
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
