use crate::modelsv2::{OperationalPointModel, RetrieveBatch};
use crate::schema::OperationalPointPart;
use crate::views::timetable::TimetableError;
use crate::{core::CoreClient, views::timetable::Path, DbPool};
use actix_web::{post, web::Data};
use chrono::{DateTime, Utc};
use diesel_async::AsyncPgConnection;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;

use crate::core::pathfinding::{PathfindingRequest, PathfindingWaypoints, Waypoint};
use crate::core::simulation::{CoreTrainSchedule, SimulationRequest, TrainStop};
use crate::core::AsCoreRequest;
use crate::error::{InternalError, Result};
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

impl TimetableImportItem {
    pub fn report_error(
        &self,
        error: TimetableImportError,
    ) -> HashMap<String, TimetableImportError> {
        self.trains
            .iter()
            .map(|train| (train.name.clone(), TrainImportReport::new(error.clone())))
            .collect()
    }
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
    TrackOffset { track_section: String, offset: f64 },
    #[serde(rename = "operational_point")]
    OperationalPoint { uic: i64 },
    #[serde(rename = "operational_point_id")]
    OperationalPointId { id: String },
}

#[derive(Debug, Serialize, ToSchema)]
struct TimetableImportReport {
    errors: HashMap<String, TimetableImportError>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub enum TimetableImportError {
    RollingStockNotFound {
        name: String,
    },
    OperationalPointNotFound {
        missing_uics: Vec<i64>,
        missing_ids: Vec<String>,
    },
    PathfindingError {
        cause: InternalError,
    },
    SimulationError {
        cause: InternalError,
    },
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TimetableImportTrain {
    #[schema(example = "7015")]
    name: String,
    #[schema(example = "2023-08-17T08:46:00+02:00")]
    departure_time: DateTime<Utc>,
}

struct OperationalPointsToParts {
    from_uic: HashMap<i64, Vec<OperationalPointPart>>,
    from_id: HashMap<String, Vec<OperationalPointPart>>,
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
        return Ok(
            import_item.report_error(TimetableImportError::RollingStockNotFound {
                name: import_item.rolling_stock.clone(),
            }),
        );
    };
    let rolling_stock_id = rolling_stock_model.id.unwrap();
    let rollingstock_version = rolling_stock_model.version;
    let rolling_stock: RollingStock = rolling_stock_model.into();

    // PATHFINDING
    let mut pf_request = PathfindingRequest::new(infra_id, infra_version.to_owned());
    pf_request.with_rolling_stocks(&mut vec![rolling_stock.clone()]);
    let ops_uic = ops_uic_from_path(&import_item.path);
    let ops_id = ops_id_from_path(&import_item.path);
    // Retrieve operational points
    let op_to_parts = match find_operation_points(&ops_uic, &ops_id, infra_id, conn).await? {
        Ok(op_to_parts) => op_to_parts,
        Err(err) => {
            return Ok(import_item.report_error(err.clone()));
        }
    };
    // Create waypoints
    let mut waypoints = waypoints_from_steps(&import_item.path, &op_to_parts);
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
            return Ok(
                import_item.report_error(TimetableImportError::PathfindingError {
                    cause: error.clone(),
                }),
            );
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

    let mut fake_stops: Vec<_> = path_response
        .payload
        .path_waypoints
        .clone()
        .iter()
        .filter(|pw| pw.suggestion)
        .map(|pw| TrainStop {
            position: Some(pw.path_offset),
            location: None,
            duration: 0.,
        })
        .collect();

    // TRAIN SCHEDULES

    let request = build_simulation_request(
        &import_item,
        &waypoint_offsets,
        &mut fake_stops,
        &rolling_stock,
        infra_id,
        path_response,
    );
    // Run the simulation
    let response_payload = match request.fetch(core_client).await {
        Ok(response_payload) => response_payload,
        Err(error) => {
            return Ok(
                import_item.report_error(TimetableImportError::SimulationError {
                    cause: error.clone(),
                }),
            );
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
    ops_id: &[String],
    infra_id: i64,
    conn: &mut AsyncPgConnection,
) -> Result<std::result::Result<OperationalPointsToParts, TimetableImportError>> {
    // Retrieve operational points
    let ops_from_uic = OperationalPointModel::retrieve_from_uic(conn, infra_id, ops_uic).await?;
    let mut op_uic_to_parts = HashMap::<_, Vec<_>>::new();
    for op in ops_from_uic {
        op_uic_to_parts
            .entry(op.schema.extensions.identifier.unwrap().uic)
            .or_default()
            .extend(op.schema.parts);
    }
    let mut missing_uics: Vec<i64> = vec![];
    // If we didn't find all the operational points, we can't run the pathfinding
    if op_uic_to_parts.len() != ops_uic.len() {
        ops_uic.iter().for_each(|uic| {
            if !op_uic_to_parts.contains_key(uic) {
                missing_uics.push(*uic)
            }
        });
    }

    let ops_full_ids = ops_id.iter().map(|obj_id| (infra_id, obj_id.clone()));
    let (ops_from_ids, missing_ids) =
        OperationalPointModel::retrieve_batch::<_, Vec<_>>(conn, ops_full_ids).await?;
    let mut op_id_to_parts = HashMap::<_, Vec<_>>::new();
    for op in ops_from_ids {
        op_id_to_parts
            .entry(op.obj_id)
            .or_default()
            .extend(op.schema.parts);
    }
    // If we didn't find all the operational points, we can't run the pathfinding
    let missing_ids: Vec<String> = missing_ids.into_iter().map(|(_, obj_id)| obj_id).collect();
    if missing_uics.len() + missing_ids.len() > 0 {
        return Ok(Err(TimetableImportError::OperationalPointNotFound {
            missing_uics,
            missing_ids,
        }));
    }

    Ok(Ok(OperationalPointsToParts {
        from_uic: op_uic_to_parts,
        from_id: op_id_to_parts,
    }))
}

fn ops_uic_from_path(path: &[TimetableImportPathStep]) -> Vec<i64> {
    let mut ops_uic = path
        .iter()
        .filter_map(|step| match &step.location {
            TimetableImportPathLocation::OperationalPoint { uic } => Some(*uic),
            _ => None,
        })
        .collect::<Vec<_>>();
    // Remove duplicates
    ops_uic.sort();
    ops_uic.dedup();
    ops_uic
}

fn ops_id_from_path(path: &[TimetableImportPathStep]) -> Vec<String> {
    let mut ops_id = path
        .iter()
        .filter_map(|step| match &step.location {
            TimetableImportPathLocation::OperationalPointId { id } => Some(id.to_string()),
            _ => None,
        })
        .collect::<Vec<_>>();
    // Remove duplicates
    ops_id.sort();
    ops_id.dedup();
    ops_id
}

fn waypoints_from_steps(
    path: &Vec<TimetableImportPathStep>,
    op_to_parts: &OperationalPointsToParts,
) -> Vec<Vec<Waypoint>> {
    let mut res = PathfindingWaypoints::new();
    for step in path {
        res.push(match &step.location {
            TimetableImportPathLocation::TrackOffset {
                track_section,
                offset,
            } => Vec::from(Waypoint::bidirectional(track_section, *offset)),
            TimetableImportPathLocation::OperationalPoint { uic } => op_to_parts
                .from_uic
                .get(uic)
                .unwrap()
                .iter()
                .flat_map(|op_part| Waypoint::bidirectional(&op_part.track, op_part.position))
                .collect(),
            TimetableImportPathLocation::OperationalPointId { id } => op_to_parts
                .from_id
                .get(id)
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
    fake_stops: &mut Vec<TrainStop>,
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

        stops.append(fake_stops);
        stops.sort_by(|a, b| {
            a.position
                .unwrap()
                .partial_cmp(&b.position.unwrap())
                .unwrap_or(Ordering::Equal)
        });

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
        let mut op_uic_to_parts = HashMap::new();
        op_uic_to_parts.insert(
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

        let mut op_id_to_parts = HashMap::new();
        op_id_to_parts.insert(
            "a1".to_string(),
            vec![
                OperationalPointPart {
                    track: Identifier("E".to_string()),
                    position: 0.,
                    ..Default::default()
                },
                OperationalPointPart {
                    track: Identifier("F".to_string()),
                    position: 100.,
                    ..Default::default()
                },
            ],
        );

        let path = vec![
            TimetableImportPathStep {
                location: TimetableImportPathLocation::TrackOffset {
                    track_section: "C".to_string(),
                    offset: 50.,
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPoint { uic: 1 },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointId {
                    id: "a1".to_string(),
                },
                schedule: HashMap::new(),
            },
        ];

        let waypoints = waypoints_from_steps(
            &path,
            &(OperationalPointsToParts {
                from_uic: op_uic_to_parts,
                from_id: op_id_to_parts,
            }),
        );

        assert_eq!(waypoints.len(), 3);
        assert_eq!(waypoints[0], Waypoint::bidirectional("C", 50.));
        assert_eq!(
            waypoints[1],
            [
                Waypoint::bidirectional("A", 0.),
                Waypoint::bidirectional("B", 100.),
            ]
            .concat()
        );
        assert_eq!(
            waypoints[2],
            [
                Waypoint::bidirectional("E", 0.),
                Waypoint::bidirectional("F", 100.),
            ]
            .concat()
        );
    }

    #[test]
    fn test_ops_uic_id_from_path() {
        let path = vec![
            TimetableImportPathStep {
                location: TimetableImportPathLocation::TrackOffset {
                    track_section: "A".to_string(),
                    offset: 0.,
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPoint { uic: 1 },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointId {
                    id: "a1".to_string(),
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPoint { uic: 2 },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::TrackOffset {
                    track_section: "B".to_string(),
                    offset: 100.,
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointId {
                    id: "a2".to_string(),
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPointId {
                    id: "a1".to_string(),
                },
                schedule: HashMap::new(),
            },
            TimetableImportPathStep {
                location: TimetableImportPathLocation::OperationalPoint { uic: 1 },
                schedule: HashMap::new(),
            },
        ];

        let ops_uic = ops_uic_from_path(&path);

        assert_eq!(ops_uic.len(), 2);
        assert_eq!(ops_uic[0], 1);
        assert_eq!(ops_uic[1], 2);

        let ops_id = ops_id_from_path(&path);

        assert_eq!(ops_id.len(), 2);
        assert_eq!(ops_id[0], "a1");
        assert_eq!(ops_id[1], "a2");
    }
}
