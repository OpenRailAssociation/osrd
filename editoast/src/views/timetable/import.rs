use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::Arc;

use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use chrono::DateTime;
use chrono::Timelike;
use chrono::Utc;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockComfortType;
use futures::future::try_join_all;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::pathfinding::PathfindingRequest;
use crate::core::pathfinding::PathfindingWaypoints;
use crate::core::pathfinding::Waypoint;
use crate::core::simulation::CoreTrainSchedule;
use crate::core::simulation::SimulationRequest;
use crate::core::simulation::TrainStop;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Pathfinding;
use crate::models::ScheduledPoint;
use crate::models::Timetable;
use crate::models::TrainSchedule;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::modelsv2::OperationalPointModel;
use crate::modelsv2::RetrieveBatch;
use crate::modelsv2::RollingStockModel;
use crate::views::infra::fetch_infra_state;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraState;
use crate::views::pathfinding::save_core_pathfinding;
use crate::views::timetable::Path;
use crate::views::timetable::TimetableError;
use crate::views::train_schedule::process_simulation_response;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;
use editoast_schemas::infra::OperationalPointPart;

crate::routes! {
    post_timetable,
}

editoast_common::schemas! {
    TimetableImportItem,
    TimetableImportPathStep,
    TimetableImportPathSchedule,
    TimetableImportPathLocation,
    TimetableImportTrain,
    TrainImportReport,
    ImportTimings,
    TimetableImportError,
}
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TimetableImportItem {
    #[schema(example = "2TGV2N2")]
    rolling_stock: String,
    path: Vec<TimetableImportPathStep>,
    trains: Vec<TimetableImportTrain>,
    pathfinding_timeout: Option<f64>,
}

impl TimetableImportItem {
    pub fn report_error(
        &self,
        error: TimetableImportError,
        timings: ImportTimings,
    ) -> HashMap<String, TrainImportReport> {
        self.trains
            .iter()
            .map(|train| {
                (
                    train.name.clone(),
                    TrainImportReport {
                        error: Some(error.clone()),
                        timings: timings.clone(),
                    },
                )
            })
            .collect()
    }

    pub fn report_success(&self, timings: ImportTimings) -> HashMap<String, TrainImportReport> {
        self.trains
            .iter()
            .map(|train| {
                (
                    train.name.clone(),
                    TrainImportReport {
                        error: None,
                        timings: timings.clone(),
                    },
                )
            })
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
pub struct TrainImportReport {
    error: Option<TimetableImportError>,
    timings: ImportTimings,
}

#[derive(Debug, Serialize, ToSchema, Default, Clone)]
pub struct ImportTimings {
    pub pathfinding: Option<f64>,
    pub simulation: Option<f64>,
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
/// Returns data about the import for each train imported
#[utoipa::path(
    tag = "timetable",
    params(
        ("id" = u64, Path, description = "Timetable id"),
    ),
    responses(
        (status = 200, description = "Import report", body = HashMap<String, TrainImportReport>),
    ),
)]
#[post("")]
pub async fn post_timetable(
    db_pool: Data<DbConnectionPool>,
    timetable_id: Path<i64>,
    core_client: Data<CoreClient>,
    data: Json<Vec<TimetableImportItem>>,
) -> Result<Json<HashMap<String, TrainImportReport>>> {
    let timetable_id = timetable_id.into_inner();
    let mut conn = db_pool.get().await?;

    // Retrieve the timetable
    let timetable = {
        use crate::models::Retrieve;
        Timetable::retrieve_conn(&mut conn, timetable_id)
            .await?
            .ok_or_else(|| Into::<InternalError>::into(TimetableError::NotFound { timetable_id }))?
    };

    let scenario = timetable.get_scenario_conn(&mut conn).await?;
    let infra_id = scenario.infra_id.expect("Scenario should have an infra id");
    let infra =
        Infra::retrieve_or_fail(&mut conn, infra_id, || InfraApiError::NotFound { infra_id })
            .await?;

    // Check infra is loaded
    let core_client = core_client.as_ref();
    let infra_status = fetch_infra_state(infra_id, core_client).await?.status;
    if infra_status != InfraState::Cached {
        return Err(TimetableError::InfraNotLoaded { infra_id }.into());
    }

    let db_pool = db_pool.into_inner();
    let mut item_futures = Vec::new();

    for item in data.into_inner() {
        item_futures.push(import_item(
            infra_id,
            &infra.version,
            db_pool.clone(),
            item,
            timetable_id,
            core_client,
        ));
    }
    let item_results = try_join_all(item_futures).await?;

    let reports: HashMap<String, TrainImportReport> = item_results
        .into_iter()
        .flat_map(|res| res.into_iter())
        .collect();

    Ok(Json(reports))
}

macro_rules! time_execution {
    ($s:expr) => {{
        let timer = std::time::Instant::now();
        let res = $s;
        (res, timer.elapsed().as_secs_f64())
    }};
}

async fn import_item(
    infra_id: i64,
    infra_version: &str,
    db_pool: Arc<DbConnectionPool>,
    import_item: TimetableImportItem,
    timetable_id: i64,
    core_client: &CoreClient,
) -> Result<HashMap<String, TrainImportReport>> {
    let mut conn = db_pool.get().await?;
    let mut timings = ImportTimings::default();

    let Some(rolling_stock_model) =
        RollingStockModel::retrieve(&mut conn, import_item.rolling_stock.clone()).await?
    else {
        return Ok(import_item.report_error(
            TimetableImportError::RollingStockNotFound {
                name: import_item.rolling_stock.clone(),
            },
            timings.clone(),
        ));
    };
    let rolling_stock_id = rolling_stock_model.id;
    let rollingstock_version = rolling_stock_model.version;
    let rolling_stock: RollingStock = rolling_stock_model.into();

    // PATHFINDING
    let mut pf_request = PathfindingRequest::new(
        infra_id,
        infra_version.to_owned(),
        import_item.pathfinding_timeout,
    );
    pf_request.with_rolling_stocks(&mut vec![rolling_stock.clone()]);
    let ops_uic = ops_uic_from_path(&import_item.path);
    let ops_id = ops_id_from_path(&import_item.path);
    // Retrieve operational points
    let op_to_parts = match find_operation_points(&ops_uic, &ops_id, infra_id, &mut conn).await? {
        Ok(op_to_parts) => op_to_parts,
        Err(err) => {
            return Ok(import_item.report_error(err.clone(), timings.clone()));
        }
    };
    // Create waypoints
    let mut waypoints = waypoints_from_steps(&import_item.path, &op_to_parts);
    pf_request.with_waypoints(&mut waypoints);

    // Run pathfinding
    // TODO: Stops duration should be associated to trains not path
    let steps_duration = vec![0.; pf_request.nb_waypoints()];
    let (raw_path_response, elapsed) = time_execution!(pf_request.fetch(core_client).await);
    timings.pathfinding = Some(elapsed);
    let pathfinding_result = match raw_path_response {
        Err(error) => {
            return Ok(import_item.report_error(
                TimetableImportError::PathfindingError {
                    cause: error.clone(),
                },
                timings.clone(),
            ));
        }
        Ok(raw_path_response) => {
            save_core_pathfinding(raw_path_response, &mut conn, infra_id, None, steps_duration)
                .await?
        }
    };
    let path_id = pathfinding_result.id;

    let waypoint_offsets: Vec<_> = pathfinding_result
        .payload
        .path_waypoints
        .iter()
        .filter(|pw| !pw.suggestion)
        .map(|pw| pw.path_offset)
        .collect();

    let mut fake_stops: Vec<_> = pathfinding_result
        .payload
        .path_waypoints
        .clone()
        .iter()
        .filter(|pw| pw.suggestion)
        .map(|pw| TrainStop {
            position: Some(pw.path_offset),
            location: None,
            duration: 0.,
            on_stop_signal: false,
        })
        .collect();

    // TRAIN SCHEDULES

    let request = build_simulation_request(
        &import_item,
        &waypoint_offsets,
        &mut fake_stops,
        &rolling_stock,
        infra_id,
        pathfinding_result,
    );
    // Run the simulation
    let (response_payload, elapsed) = time_execution!(request.fetch(core_client).await);
    timings.simulation = Some(elapsed);
    let response_payload = match response_payload {
        Ok(response_payload) => response_payload,
        Err(error) => {
            return Ok(import_item.report_error(
                TimetableImportError::SimulationError {
                    cause: error.clone(),
                },
                timings.clone(),
            ));
        }
    };

    // Post process the response
    let simulation_outputs = process_simulation_response(response_payload)?;
    assert_eq!(simulation_outputs.len(), import_item.trains.len());

    // Save train schedules
    for (import_train, mut sim_output) in import_item.trains.iter().zip(simulation_outputs) {
        use crate::models::Create;
        let train_id = TrainSchedule {
            train_name: import_train.name.clone(),
            departure_time: import_train.departure_time.num_seconds_from_midnight() as f64,
            scheduled_points: Default::default(), // TODO change
            path_id,
            rolling_stock_id,
            timetable_id,
            infra_version: Some(infra_version.to_owned()),
            rollingstock_version: Some(rollingstock_version),
            ..Default::default()
        }
        .create_conn(&mut conn)
        .await?
        .id;

        sim_output.train_schedule_id = Some(train_id);
        sim_output.create_conn(&mut conn).await?;
    }

    Ok(import_item.report_success(timings))
}

async fn find_operation_points(
    ops_uic: &[i64],
    ops_id: &[String],
    infra_id: i64,
    conn: &mut DbConnection,
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
                    on_stop_signal: duration > 0.,
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
    use super::*;
    use editoast_schemas::primitives::Identifier;

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
