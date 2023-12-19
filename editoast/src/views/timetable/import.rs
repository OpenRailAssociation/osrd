use crate::views::timetable::TimetableError;
use crate::{core::CoreClient, views::timetable::Path, DbPool};
use actix_web::{post, web::Data};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashMap;

use crate::core::pathfinding::{PathfindingRequest, PathfindingWaypoints, Waypoint};
use crate::core::simulation::{CoreTrainSchedule, SimulationRequest, TrainStop};
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::models::infra_objects::operational_point::OperationalPointModel;
use crate::models::{
    Create, Infra, Retrieve, RollingStockModel, ScheduledPoint, Timetable, TrainSchedule,
};
use crate::schema::rolling_stock::{RollingStock, RollingStockComfortType};
use crate::views::infra::{call_core_infra_state, InfraState};
use crate::views::pathfinding::run_pathfinding;
use crate::views::train_schedule::process_simulation_response;
use actix_web::web::Json;
use actix_web::HttpResponse;
use chrono::Timelike;

use utoipa::ToSchema;

crate::routes! {
    post_timetable,
}

crate::schemas! {
    TimetableImportItem,
    TimetableImportPathStep,
    TimetableImportPathSchedule,
    TimetableImportPathLocation,
    TimetableImportTrain,
}
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TimetableImportItem {
    #[schema(example = "2TGV2N2")]
    rolling_stock: String,
    path: Vec<TimetableImportPathStep>,
    trains: Vec<TimetableImportTrain>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TimetableImportPathStep {
    location: TimetableImportPathLocation,
    #[serde(default)]
    #[schema(example = json!({"7015": {"arrival_time": "2023-08-17T09:46:00+02:00", "departure_time": "2023-08-17T09:56:00+02:00"}}))]
    schedule: HashMap<String, TimetableImportPathSchedule>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TimetableImportPathSchedule {
    pub arrival_time: DateTime<Utc>,
    pub departure_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(tag = "type")]
pub enum TimetableImportPathLocation {
    #[serde(rename = "track_offset")]
    TrackOffsetLocation { track_section: String, offset: f64 },
    #[serde(rename = "operational_point")]
    OperationalPointLocation { uic: i64 },
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TimetableImportTrain {
    #[schema(example = "7015")]
    name: String,
    #[schema(example = "2023-08-17T08:46:00+02:00")]
    departure_time: DateTime<Utc>,
}

/// Import a timetable
#[utoipa::path(
    tag = "timetable",
    params(
        ("id" = u64, Path, description = "Timetable id"),
    ),
    responses(
        (status = 204, description = "Timetable was successfully imported"),
    ),
)]
#[post("")]
pub async fn post_timetable(
    db_pool: Data<DbPool>,
    timetable_id: Path<i64>,
    core_client: Data<CoreClient>,
    data: Json<Vec<TimetableImportItem>>,
) -> Result<HttpResponse> {
    let timetable_id = timetable_id.into_inner();
    let mut conn = db_pool.get().await?;

    // Retrieve the timetable
    let Some(timetable) = Timetable::retrieve_conn(&mut conn, timetable_id).await? else {
        return Err(TimetableError::NotFound { timetable_id }.into());
    };

    let scenario = timetable.get_scenario_conn(&mut conn).await?;
    let infra_id = scenario.infra_id.expect("Scenario should have an infra id");
    let infra = Infra::retrieve_conn(&mut conn, infra_id).await?.unwrap();
    let (infra_id, infra_version) = (infra.id.unwrap(), infra.version.unwrap());

    // Check infra is loaded
    let mut infra_state =
        call_core_infra_state(Some(infra_id), db_pool.clone(), core_client.clone()).await?;
    let infra_status = infra_state
        .remove(&infra_id.to_string())
        .unwrap_or_default()
        .status;
    if infra_status != InfraState::Cached {
        return Err(TimetableError::InfraNotLoaded { infra_id }.into());
    }

    let pathfinding_request = PathfindingRequest::new(infra_id, infra_version.clone());
    for import_item in data.into_inner() {
        // PATHFINDING
        let mut pf_request = pathfinding_request.clone();
        let Some(rolling_stock_model) =
            RollingStockModel::retrieve_by_name(&mut conn, import_item.rolling_stock.clone())
                .await?
        else {
            continue;
        };
        let rolling_stock: RollingStock = rolling_stock_model.clone().into();
        pf_request.with_rolling_stocks(&mut vec![rolling_stock.clone()]);
        // List operational points uic needed for this import
        let mut ops_uic = import_item
            .path
            .iter()
            .filter_map(|step| match &step.location {
                TimetableImportPathLocation::OperationalPointLocation { uic } => Some(*uic),
                _ => None,
            })
            .collect::<Vec<_>>();
        // Remove duplicates
        ops_uic.sort();
        ops_uic.dedup();
        // Retrieve operational points
        let ops =
            OperationalPointModel::retrieve_from_uic(&mut conn, infra_id, ops_uic.clone()).await?;
        let mut op_id_to_parts = HashMap::<_, Vec<_>>::new();
        for op in ops {
            op_id_to_parts
                .entry(op.data.0.extensions.identifier.unwrap().uic)
                .or_default()
                .extend(op.data.0.parts);
        }
        // If we didn't find all the operational points, we can't run the pathfinding
        if op_id_to_parts.len() != ops_uic.len() {
            continue;
        }
        // Create waypoints
        let mut waypoints = PathfindingWaypoints::new();
        for step in import_item.path.iter() {
            waypoints.push(match &step.location {
                TimetableImportPathLocation::TrackOffsetLocation {
                    track_section,
                    offset,
                } => Vec::from(Waypoint::bidirectional(track_section, *offset)),
                TimetableImportPathLocation::OperationalPointLocation { uic } => op_id_to_parts
                    .get(uic)
                    .unwrap()
                    .iter()
                    .flat_map(|op_part| Waypoint::bidirectional(&op_part.track, op_part.position))
                    .collect(),
            });
        }
        pf_request.with_waypoints(&mut waypoints);
        // Run pathfinding
        // TODO: Stops duration should be associated to trains not path
        let steps_duration = vec![0.; pf_request.nb_waypoints()];
        let path_response = match run_pathfinding(
            &pf_request,
            core_client.clone(),
            &mut conn,
            infra_id,
            None,
            steps_duration,
        )
        .await
        {
            Ok(path_response) => path_response,
            Err(_) => continue,
        };
        let path_id = path_response.id;

        let waypoint_offsets: Vec<_> = path_response
            .payload
            .path_waypoints
            .iter()
            .filter(|pw| !pw.suggestion)
            .map(|pw| pw.path_offset)
            .collect();

        // TRAIN SCHEDULES

        // Build the request
        let mut train_schedules = vec![];
        for train in import_item.trains.iter() {
            assert_eq!(waypoint_offsets.len(), import_item.path.len());
            let mut stops: Vec<_> = import_item
                .path
                .iter()
                .zip(&waypoint_offsets)
                .map(|(step, path_offset)| {
                    let duration = step.schedule.get(&train.name).map_or(0., |ps| {
                        (ps.departure_time - ps.arrival_time).num_seconds().max(0) as f64
                    });
                    TrainStop {
                        position: Some(*path_offset),
                        location: None,
                        duration,
                    }
                })
                .collect();

            // Force the last stop to be at least 1s long.
            // This is to avoid the train to stop with a non-zero speed.
            let last_stop = stops.last_mut().unwrap();
            last_stop.duration = last_stop.duration.max(1.);

            let departure_time = train.departure_time.num_seconds_from_midnight() as f64;
            let scheduled_points = import_item
                .path
                .iter()
                .zip(&waypoint_offsets)
                .filter_map(|(step, &path_offset)| {
                    if path_offset <= 0. {
                        None
                    } else {
                        step.schedule.get(&train.name).map(|ps| ScheduledPoint {
                            path_offset,
                            time: (ps.arrival_time.num_seconds_from_midnight() as f64
                                - departure_time)
                                .max(0.),
                        })
                    }
                })
                .collect();
            let core_train = CoreTrainSchedule {
                train_name: train.name.clone(),
                rolling_stock: import_item.rolling_stock.clone(),
                initial_speed: 0.,
                scheduled_points,
                allowances: vec![],
                stops,
                tag: None,
                comfort: RollingStockComfortType::Standard,
                power_restriction_ranges: None,
                options: None,
            };
            train_schedules.push(core_train);
        }

        let request = SimulationRequest {
            infra: infra_id,
            rolling_stocks: vec![rolling_stock.clone()],
            train_schedules,
            electrical_profile_set: None,
            trains_path: path_response.into(),
        };

        // Run the simulation
        let response_payload = match request.fetch(&core_client).await {
            Ok(response_payload) => response_payload,
            Err(_) => continue,
        };

        // Post process the response
        let simulation_outputs = process_simulation_response(response_payload)?;
        assert_eq!(simulation_outputs.len(), import_item.trains.len());

        // Save train schedules
        for (import_train, mut sim_output) in import_item.trains.iter().zip(simulation_outputs) {
            let train_id = TrainSchedule {
                train_name: import_train.name.clone(),
                departure_time: import_train.departure_time.num_seconds_from_midnight() as f64,
                scheduled_points: Default::default(), // TODO change
                path_id,
                rolling_stock_id: rolling_stock_model.id.unwrap(),
                timetable_id,
                infra_version: Some(infra_version.clone()),
                rollingstock_version: rolling_stock_model.version,
                ..Default::default()
            }
            .create_conn(&mut conn)
            .await?
            .id;

            sim_output.train_schedule_id = Some(train_id);
            sim_output.create_conn(&mut conn).await?;
        }
    }

    Ok(HttpResponse::NoContent().finish())
}
