use crate::schema::OperationalPointPart;
use crate::views::timetable::TimetableError;
use crate::{core::CoreClient, views::timetable::Path, DbPool};
use actix_web::{post, web::Data};
use chrono::{DateTime, Utc};
use diesel_async::AsyncPgConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::core::pathfinding::{PathfindingRequest, PathfindingWaypoints, Waypoint};
use crate::core::simulation::{CoreTrainSchedule, SimulationRequest, TrainStop};
use crate::core::AsCoreRequest;
use crate::error::{InternalError, Result};
use crate::models::infra_objects::operational_point::OperationalPointModel;
use crate::models::{
    Create, Infra, Pathfinding, Retrieve, RollingStockModel, ScheduledPoint, Timetable,
    TrainSchedule,
};
use crate::schema::rolling_stock::{RollingStock, RollingStockComfortType};
use crate::views::infra::{call_core_infra_state, InfraState};
use crate::views::pathfinding::run_pathfinding;
use crate::views::train_schedule::process_simulation_response;
use actix_web::web::Json;
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
    TimetableImportReport,
    TimetableImportError,
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

#[derive(Debug, Serialize, ToSchema)]
struct TimetableImportReport {
    errors: HashMap<String, TimetableImportError>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
enum TimetableImportError {
    RollingStockNotFound { name: String },
    OperationalPointNotFound { missing_uics: Vec<i64> },
    PathfindingError { cause: InternalError },
    SimulationError { cause: InternalError },
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
        (status = 200, description = "Import report", body = TimetableImportReport),
    ),
)]
#[post("")]
pub async fn post_timetable(
    db_pool: Data<DbPool>,
    timetable_id: Path<i64>,
    core_client: Data<CoreClient>,
    data: Json<Vec<TimetableImportItem>>,
) -> Result<Json<TimetableImportReport>> {
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

    let mut errors = HashMap::new();

    for item in data.into_inner() {
        errors.extend(
            import_item(
                infra_id,
                &infra_version,
                &mut conn,
                item,
                timetable_id,
                &core_client,
            )
            .await?,
        );
    }

    Ok(Json(TimetableImportReport { errors }))
}

async fn import_item(
    infra_id: i64,
    infra_version: &str,
    conn: &mut AsyncPgConnection,
    import_item: TimetableImportItem,
    timetable_id: i64,
    core_client: &CoreClient,
) -> Result<HashMap<String, TimetableImportError>> {
    let Some(rolling_stock_model) =
        RollingStockModel::retrieve_by_name(conn, import_item.rolling_stock.clone()).await?
    else {
        return Ok(import_item
            .trains
            .into_iter()
            .map(|train| {
                (
                    train.name,
                    TimetableImportError::RollingStockNotFound {
                        name: import_item.rolling_stock.clone(),
                    },
                )
            })
            .collect());
    };
    let rolling_stock_id = rolling_stock_model.id.unwrap();
    let rollingstock_version = rolling_stock_model.version;
    let rolling_stock: RollingStock = rolling_stock_model.into();

    // PATHFINDING
    let mut pf_request = PathfindingRequest::new(infra_id, infra_version.to_owned());
    pf_request.with_rolling_stocks(&mut vec![rolling_stock.clone()]);
    // List operational points uic needed for this import
    let ops_uic = ops_uic_from_path(&import_item.path);
    // Retrieve operational points
    let op_id_to_parts = match find_operation_points(&ops_uic, infra_id, conn).await? {
        Ok(op_id_to_parts) => op_id_to_parts,
        Err(err) => {
            return Ok(import_item
                .trains
                .into_iter()
                .map(|train: TimetableImportTrain| (train.name, err.clone()))
                .collect());
        }
    };
    // Create waypoints
    let mut waypoints = waypoints_from_steps(&import_item.path, &op_id_to_parts);
    pf_request.with_waypoints(&mut waypoints);

    // Run pathfinding
    // TODO: Stops duration should be associated to trains not path
    let steps_duration = vec![0.; pf_request.nb_waypoints()];
    let path_response = match run_pathfinding(
        &pf_request,
        core_client,
        conn,
        infra_id,
        None,
        steps_duration,
    )
    .await
    {
        Ok(path_response) => path_response,
        Err(error) => {
            return Ok(import_item
                .trains
                .into_iter()
                .map(|train: TimetableImportTrain| {
                    (
                        train.name,
                        TimetableImportError::PathfindingError {
                            cause: error.clone(),
                        },
                    )
                })
                .collect());
        }
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

    let request = build_simulation_request(
        &import_item,
        &waypoint_offsets,
        &rolling_stock,
        infra_id,
        path_response,
    );
    // Run the simulation
    let response_payload = match request.fetch(core_client).await {
        Ok(response_payload) => response_payload,
        Err(error) => {
            return Ok(import_item
                .trains
                .into_iter()
                .map(|train: TimetableImportTrain| {
                    (
                        train.name,
                        TimetableImportError::SimulationError {
                            cause: error.clone(),
                        },
                    )
                })
                .collect());
        }
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
            rolling_stock_id,
            timetable_id,
            infra_version: Some(infra_version.to_owned()),
            rollingstock_version,
            ..Default::default()
        }
        .create_conn(conn)
        .await?
        .id;

        sim_output.train_schedule_id = Some(train_id);
        sim_output.create_conn(conn).await?;
    }

    Ok(HashMap::new())
}

async fn find_operation_points(
    ops_uic: &[i64],
    infra_id: i64,
    conn: &mut AsyncPgConnection,
) -> Result<std::result::Result<HashMap<i64, Vec<OperationalPointPart>>, TimetableImportError>> {
    // Retrieve operational points
    let ops = OperationalPointModel::retrieve_from_uic(conn, infra_id, ops_uic).await?;
    let mut op_id_to_parts = HashMap::<_, Vec<_>>::new();
    for op in ops {
        op_id_to_parts
            .entry(op.data.0.extensions.identifier.unwrap().uic)
            .or_default()
            .extend(op.data.0.parts);
    }
    // If we didn't find all the operational points, we can't run the pathfinding
    if op_id_to_parts.len() != ops_uic.len() {
        let missing_uics = ops_uic
            .iter()
            .filter(|uic| !op_id_to_parts.contains_key(uic))
            .cloned()
            .collect();
        return Ok(Err(TimetableImportError::OperationalPointNotFound {
            missing_uics,
        }));
    }
    Ok(Ok(op_id_to_parts))
}

fn ops_uic_from_path(path: &[TimetableImportPathStep]) -> Vec<i64> {
    let mut ops_uic = path
        .iter()
        .filter_map(|step| match &step.location {
            TimetableImportPathLocation::OperationalPointLocation { uic } => Some(*uic),
            _ => None,
        })
        .collect::<Vec<_>>();
    // Remove duplicates
    ops_uic.sort();
    ops_uic.dedup();
    ops_uic
}

fn waypoints_from_steps(
    path: &Vec<TimetableImportPathStep>,
    op_id_to_parts: &HashMap<i64, Vec<OperationalPointPart>>,
) -> Vec<Vec<Waypoint>> {
    let mut res = PathfindingWaypoints::new();
    for step in path {
        res.push(match &step.location {
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
    res
}

// Build the request
fn build_simulation_request(
    import_item: &TimetableImportItem,
    waypoint_offsets: &[f64],
    rolling_stock: &RollingStock,
    infra_id: i64,
    path_response: Pathfinding,
) -> SimulationRequest {
    let mut train_schedules = vec![];
    for train in import_item.trains.iter() {
        assert_eq!(waypoint_offsets.len(), import_item.path.len());
        let mut stops: Vec<_> = import_item
            .path
            .iter()
            .zip(waypoint_offsets)
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
            .zip(waypoint_offsets)
            .filter_map(|(step, &path_offset)| {
                if path_offset <= 0. {
                    None
                } else {
                    step.schedule.get(&train.name).map(|ps| ScheduledPoint {
                        path_offset,
                        time: (ps.arrival_time.num_seconds_from_midnight() as f64 - departure_time)
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

    SimulationRequest {
        infra: infra_id,
        rolling_stocks: vec![rolling_stock.clone()],
        train_schedules,
        electrical_profile_set: None,
        trains_path: path_response.into(),
    }
}

#[cfg(test)]
mod tests {
    use crate::schema::utils::Identifier;

    use super::*;

    #[test]
    fn test_waypoints_from_steps() {
        let mut op_id_to_parts = HashMap::new();
        op_id_to_parts.insert(
            1,
            vec![
                OperationalPointPart {
                    track: Identifier("A".to_string()),
                    position: 0.,
                    ..Default::default()
                },
                OperationalPointPart {
                    track: Identifier("B".to_string()),
                    position: 100.,
                    ..Default::default()
                },
            ],
        );

        let path = vec![
            TimetableImportPathStep {
                location: TimetableImportPathLocation::TrackOffsetLocation {
                    track_section: "C".to_string(),
                    offset: 50.,
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointLocation { uic: 1 },
                schedule: HashMap::new(),
            },
        ];

        let waypoints = waypoints_from_steps(&path, &op_id_to_parts);

        assert_eq!(waypoints.len(), 2);
        assert_eq!(waypoints[0], Waypoint::bidirectional("C", 50.));
        assert_eq!(
            waypoints[1],
            [
                Waypoint::bidirectional("A", 0.),
                Waypoint::bidirectional("B", 100.),
            ]
            .concat()
        );
    }

    #[test]
    fn test_ops_uic_from_path() {
        let path = vec![
            TimetableImportPathStep {
                location: TimetableImportPathLocation::TrackOffsetLocation {
                    track_section: "A".to_string(),
                    offset: 0.,
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointLocation { uic: 1 },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointLocation { uic: 2 },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::TrackOffsetLocation {
                    track_section: "B".to_string(),
                    offset: 100.,
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointLocation { uic: 1 },
                schedule: HashMap::new(),
            },
        ];

        let ops_uic = ops_uic_from_path(&path);

        assert_eq!(ops_uic.len(), 2);
        assert_eq!(ops_uic[0], 1);
        assert_eq!(ops_uic[1], 2);
    }
}
