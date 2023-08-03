use std::collections::{HashMap, HashSet};

use crate::core::{AsCoreRequest, CoreClient};
use crate::error::{InternalError, Result};
use crate::models::train_schedule::{Allowance, ScheduledPoint};
use crate::models::{
    Create, Delete, Infra, LightRollingStockModel, Pathfinding, Retrieve, RollingStockModel,
    Scenario, SimulationOutput, SimulationOutputChangeset, TrainScheduleChangeset, Update,
};
use crate::models::{Timetable, TrainSchedule};

use crate::views::train_schedule::simulation_report::fetch_simulation_output;
use crate::DieselJson;

use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, scope, Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use diesel::Connection;
use editoast_derive::EditoastError;
use itertools::izip;
use serde_derive::Deserialize;
use serde_json::Value as JsonValue;

use crate::core::simulation::{
    CoreTrainSchedule, SimulationRequest, SimulationResponse, TrainStop,
};

use simulation_report::SimulationReport;
use thiserror::Error;

use crate::models::electrical_profile::ElectricalProfileSet;
use futures::executor;

pub mod projection;
pub mod simulation_report;
use self::projection::Projection;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule")]
pub enum TrainScheduleError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 400)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Train Schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 400)]
    NotFound { train_schedule_id: i64 },
    #[error("Rolling Stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 400)]
    RollingStockNotFound { rolling_stock_id: i64 },
    #[error("Path '{path_id}', could not be found")]
    #[editoast_error(status = 400)]
    PathNotFound { path_id: i64 },
    #[error("Train Schedule must have an id for PATCH")]
    #[editoast_error(status = 400)]
    NoPatchId,
    #[error("Train Schedule '{train_schedule_id}' is not simulated")]
    #[editoast_error(status = 500)]
    UnsimulatedTrainSchedule { train_schedule_id: i64 },
    #[error("No train ids given")]
    #[editoast_error(status = 400)]
    NoTrainIds,
    #[error("No train schedules given")]
    #[editoast_error(status = 400)]
    NoTrainSchedules,
    #[error("Batch should have the same timetable")]
    #[editoast_error(status = 400)]
    BatchShouldHaveSameTimetable,
    #[error("No simulation given")]
    #[editoast_error(status = 500)]
    NoSimulation,
}

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/train_schedule")
        .service((get_results, standalone_simulation, delete_multiple))
        .service(scope("/{id}").service((delete, patch, get_result, get)))
}

/// Return a specific timetable with its associated schedules
#[get("")]
async fn get(db_pool: Data<DbPool>, train_schedule_id: Path<i64>) -> Result<Json<TrainSchedule>> {
    let train_schedule_id = train_schedule_id.into_inner();

    // Return the timetable
    let train_schedule = match TrainSchedule::retrieve(db_pool.clone(), train_schedule_id).await? {
        Some(train_schedule) => train_schedule,
        None => return Err(TrainScheduleError::NotFound { train_schedule_id }.into()),
    };
    Ok(Json(train_schedule))
}

// Delete a specific train schedule
#[delete("")]
async fn delete(db_pool: Data<DbPool>, train_schedule_id: Path<i64>) -> Result<HttpResponse> {
    let train_schedule_id = train_schedule_id.into_inner();
    if !TrainSchedule::delete(db_pool.clone(), train_schedule_id).await? {
        return Err(TrainScheduleError::NotFound { train_schedule_id }.into());
    }

    Ok(HttpResponse::NoContent().finish())
}
#[derive(Debug, Deserialize)]
pub struct BatchDeletionRequest {
    ids: Vec<i64>,
}
//Delete multiple train schedule
#[delete("")]
pub async fn delete_multiple(
    db_pool: Data<DbPool>,
    request: Json<BatchDeletionRequest>,
) -> Result<HttpResponse> {
    use crate::tables::osrd_infra_trainschedule::dsl::*;
    use diesel::prelude::*;

    let train_schedule_ids = request.into_inner().ids;
    diesel::delete(osrd_infra_trainschedule.filter(id.eq_any(train_schedule_ids)))
        .execute(&mut db_pool.get()?)?;

    Ok(HttpResponse::NoContent().finish())
}

/// Patch a timetable
#[patch("")]
async fn patch(
    db_pool: Data<DbPool>,
    train_schedules_changesets: Json<Vec<TrainScheduleChangeset>>,
    core: Data<CoreClient>,
) -> Result<HttpResponse> {
    let train_schedules_changesets = train_schedules_changesets.into_inner();
    if train_schedules_changesets.is_empty() {
        return Err(TrainScheduleError::NoTrainSchedules.into());
    }
    let mut conn = db_pool.get()?;
    conn.transaction::<_, InternalError, _>(|conn| {
        let mut train_schedules = Vec::new();
        for changeset in train_schedules_changesets {
            let id = changeset.id.ok_or(TrainScheduleError::NoPatchId)?;
            let train_schedule: TrainSchedule = match changeset.update_conn(conn, id)? {
                Some(ts) => ts,
                None => {
                    return Err(TrainScheduleError::NotFound {
                        train_schedule_id: id,
                    }
                    .into())
                }
            }
            .into();

            // Delete the associated simulation output
            {
                use crate::tables::osrd_infra_simulationoutput::dsl::*;
                use diesel::prelude::*;
                match osrd_infra_simulationoutput
                    .filter(train_schedule_id.eq(train_schedule.id.unwrap()))
                    .get_result::<SimulationOutput>(conn)
                {
                    Ok(simulation_output) => {
                        SimulationOutput::delete_conn(conn, simulation_output.id)?;
                    }
                    Err(diesel::result::Error::NotFound) => {}
                    Err(err) => return Err(err.into()),
                }
            }

            train_schedules.push(train_schedule);
        }

        // Resimulate the trains
        let id_timetable = train_schedules[0].timetable_id;
        if train_schedules
            .iter()
            .any(|ts| ts.timetable_id != id_timetable)
        {
            return Err(TrainScheduleError::BatchShouldHaveSameTimetable.into());
        }

        let timetable = Timetable::retrieve_conn(conn, id_timetable)?.ok_or(
            TrainScheduleError::TimetableNotFound {
                timetable_id: id_timetable,
            },
        )?;

        let scenario = scenario_from_timetable(&timetable, db_pool.clone())?;

        let request_payload = executor::block_on(create_backend_request_payload(
            &train_schedules,
            &scenario,
            db_pool.clone(),
        ))?;
        let response_payload = executor::block_on(request_payload.fetch(core.as_ref()))?;
        let simulation_outputs = process_simulation_response(response_payload)?;

        for simulation_output in simulation_outputs {
            simulation_output.create_conn(conn)?;
        }
        Ok(())
    })?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Deserialize)]
struct GetResultQuery {
    path_id: Option<i64>,
}

#[get("/result")]
async fn get_result(
    db_pool: Data<DbPool>,
    id: Path<i64>,
    query: Query<GetResultQuery>,
    core: Data<CoreClient>,
) -> Result<Json<SimulationReport>> {
    let train_schedule_id = id.into_inner();
    let train_schedule = match TrainSchedule::retrieve(db_pool.clone(), train_schedule_id).await? {
        Some(train_schedule) => train_schedule,
        None => return Err(TrainScheduleError::NotFound { train_schedule_id }.into()),
    };

    let projection_path_id = query.into_inner().path_id.unwrap_or(train_schedule.path_id);

    let projection_path = match Pathfinding::retrieve(db_pool.clone(), projection_path_id).await? {
        Some(path) => path,
        None => {
            return Err(TrainScheduleError::PathNotFound {
                path_id: projection_path_id,
            }
            .into())
        }
    };

    let projection_path_payload = (*projection_path.payload).clone();

    let projection = Projection::new(&projection_path_payload);

    let id_timetable = train_schedule.timetable_id;

    let timetable = Timetable::retrieve(db_pool.clone(), id_timetable)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound {
            timetable_id: id_timetable,
        })?;

    let scenario = scenario_from_timetable(&timetable, db_pool.clone())?;

    let infra = scenario.infra_id.expect("Scenario should have an infra id");

    let simulation_output = fetch_simulation_output(&train_schedule, db_pool.clone()).await?;
    let simulation_output_cs = SimulationOutputChangeset::from(simulation_output);
    let res = simulation_report::create_simulation_report(
        infra,
        train_schedule,
        &projection,
        &projection_path_payload,
        simulation_output_cs,
        db_pool.clone(),
        core.as_ref(),
    )
    .await?;
    Ok(Json(res))
}

#[derive(Deserialize)]
struct GetResultsQuery {
    path_id: Option<i64>,
    timetable_id: i64,
}

#[get("/results")]
async fn get_results(
    db_pool: Data<DbPool>,
    query: Query<GetResultsQuery>,
    core: Data<CoreClient>,
) -> Result<Json<Vec<SimulationReport>>> {
    let query = query.into_inner();

    let timetable = Timetable::retrieve(db_pool.clone(), query.timetable_id)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound {
            timetable_id: query.timetable_id,
        })?;
    let schedules = timetable.get_train_schedules(db_pool.clone()).await?;

    if schedules.is_empty() {
        return Err(TrainScheduleError::NoTrainIds.into());
    }

    let path_id = match query.path_id {
        Some(path_id) => path_id,
        None => schedules[0].path_id,
    };

    let projection_path = Pathfinding::retrieve(db_pool.clone(), path_id)
        .await?
        .ok_or(TrainScheduleError::PathNotFound { path_id })?;

    let projection_path_payload = (*projection_path.payload).clone();

    let projection = Projection::new(&projection_path_payload);

    let scenario = scenario_from_timetable(&timetable, db_pool.clone())?;

    let infra = scenario.infra_id.expect("Scenario should have an infra id");
    let mut res = Vec::new();
    for schedule in schedules {
        let simulation_output = fetch_simulation_output(&schedule, db_pool.clone()).await?;
        let simulation_output_content = SimulationOutputChangeset::from(simulation_output);
        let sim_report = simulation_report::create_simulation_report(
            infra,
            schedule,
            &projection,
            &projection_path_payload,
            simulation_output_content,
            db_pool.clone(),
            core.as_ref(),
        )
        .await?;
        res.push(sim_report);
    }

    Ok(Json(res))
}

#[derive(Debug, Deserialize)]
struct TrainScheduleBatch {
    timetable: i64,
    path: i64,
    schedules: Vec<TrainScheduleBatchItem>,
}

#[derive(Debug, Deserialize)]
struct TrainScheduleBatchItem {
    pub train_name: String,
    pub labels: JsonValue,
    pub departure_time: f64,
    pub initial_speed: f64,
    pub allowances: Vec<Allowance>,
    pub scheduled_points: Vec<ScheduledPoint>,
    pub comfort: Option<String>,
    pub speed_limit_tags: Option<String>,
    pub power_restriction_ranges: Option<JsonValue>,
    pub options: Option<JsonValue>,
    pub rolling_stock_id: i64,
    pub infra_version: Option<String>,
    pub rollingstock_version: Option<i64>,
}

impl From<TrainScheduleBatch> for Vec<TrainSchedule> {
    fn from(batch: TrainScheduleBatch) -> Self {
        let mut res = Vec::new();
        for item in batch.schedules {
            res.push(TrainSchedule {
                id: None,
                timetable_id: batch.timetable,
                path_id: batch.path,
                train_name: item.train_name,
                labels: item.labels,
                departure_time: item.departure_time,
                initial_speed: item.initial_speed,
                allowances: DieselJson(item.allowances),
                scheduled_points: DieselJson(item.scheduled_points),
                comfort: item.comfort.unwrap_or_default(),
                speed_limit_tags: item.speed_limit_tags,
                power_restriction_ranges: item.power_restriction_ranges,
                options: item.options,
                rolling_stock_id: item.rolling_stock_id,
                infra_version: item.infra_version,
                rollingstock_version: item.rollingstock_version,
            });
        }
        res
    }
}

#[post("/standalone_simulation")]
async fn standalone_simulation(
    db_pool: Data<DbPool>,
    request: Json<TrainScheduleBatch>,
    core: Data<CoreClient>,
) -> Result<Json<Vec<i64>>> {
    let request = request.into_inner();

    let id_timetable = request.timetable;

    let train_schedules: Vec<TrainSchedule> = request.into();

    if train_schedules.is_empty() {
        return Err(TrainScheduleError::NoTrainSchedules.into());
    }

    let timetable = Timetable::retrieve(db_pool.clone(), id_timetable)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound {
            timetable_id: id_timetable,
        })?;

    let scenario = scenario_from_timetable(&timetable, db_pool.clone())?;
    let infra_id = scenario.infra_id.unwrap();
    let infra = Infra::retrieve(db_pool.clone(), infra_id).await?.unwrap();
    let request_payload =
        create_backend_request_payload(&train_schedules, &scenario, db_pool.clone()).await?;
    let response_payload = request_payload.fetch(core.as_ref()).await?;
    let simulation_outputs = process_simulation_response(response_payload)?;

    assert_eq!(train_schedules.len(), simulation_outputs.len());

    let mut res_ids = Vec::new();
    let mut conn = db_pool.get()?;
    // Start a transaction
    conn.transaction::<_, InternalError, _>(|conn| {
        // Save inputs
        for mut train_schedule in train_schedules {
            train_schedule.infra_version = infra.version.clone();
            train_schedule.rollingstock_version = Some(
                LightRollingStockModel::retrieve_conn(conn, train_schedule.rolling_stock_id)?
                    .unwrap()
                    .version,
            );
            let id = train_schedule
                .create_conn(conn)?
                .id
                .expect("Train schedule should have an id");
            res_ids.push(id);
        }
        // Save outputs
        for (i, mut simulation_output) in simulation_outputs.into_iter().enumerate() {
            simulation_output.train_schedule_id = Some(Some(res_ids[i]));
            simulation_output.create_conn(conn)?;
        }
        Ok(())
    })?;
    Ok(Json(res_ids))
}

async fn create_backend_request_payload(
    train_schedules: &[TrainSchedule],
    scenario: &Scenario,
    db_pool: Data<DbPool>,
) -> Result<SimulationRequest> {
    let infra = scenario.infra_id.expect("Scenario should have an infra");
    let rolling_stocks_ids = train_schedules
        .iter()
        .map(|ts| ts.rolling_stock_id)
        .collect::<HashSet<_>>();
    let mut rolling_stocks = Vec::new();
    let mut rolling_id_to_name = HashMap::new();
    for rolling_stock_id in rolling_stocks_ids {
        let rolling_stock = RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id)
            .await?
            .ok_or(TrainScheduleError::RollingStockNotFound { rolling_stock_id })?;
        rolling_id_to_name.insert(
            rolling_stock_id,
            rolling_stock
                .name
                .clone()
                .expect("Rolling stock shoud have a name"),
        );
        rolling_stocks.push(rolling_stock.into());
    }
    let path = Pathfinding::retrieve(db_pool.clone(), train_schedules[0].path_id)
        .await?
        .ok_or_else(|| TrainScheduleError::PathNotFound {
            path_id: train_schedules[0].path_id,
        })?;

    let electrical_profile_set = match scenario.electrical_profile_set_id {
        Some(Some(id)) => {
            let mut conn = db_pool.get()?;
            let eps = ElectricalProfileSet::retrieve(&mut conn, id)?;
            eps.name
        }
        _ => None,
    };

    let mut stops = Vec::new();
    for waypoint in path.payload.path_waypoints.iter() {
        let stop = TrainStop {
            position: None,
            duration: waypoint.duration,
            location: waypoint.location.clone(),
        };
        stops.push(stop);
    }

    let train_schedules = train_schedules
        .iter()
        .map(|ts| CoreTrainSchedule {
            train_name: ts.train_name.clone(),
            rolling_stock: rolling_id_to_name
                .get(&ts.rolling_stock_id)
                .unwrap()
                .to_owned(),
            initial_speed: ts.initial_speed,
            departure_time: ts.departure_time,
            scheduled_points: ts.scheduled_points.0.to_owned(),
            allowances: ts.allowances.0.to_owned(),
            stops: stops.clone(),
            tag: ts.speed_limit_tags.clone(),
            comfort: ts.comfort.clone(),
            power_restriction_ranges: ts.power_restriction_ranges.to_owned(),
            options: ts.options.to_owned(),
        })
        .collect::<Vec<_>>();

    Ok(SimulationRequest {
        infra,
        rolling_stocks,
        train_schedules,
        electrical_profile_set,
        trains_path: path.into(),
    })
}

pub fn process_simulation_response(
    simulation_response: SimulationResponse,
) -> Result<Vec<SimulationOutputChangeset>> {
    let SimulationResponse {
        base_simulations,
        eco_simulations,
        speed_limits,
        electrification_ranges,
        power_restriction_ranges,
        ..
    } = simulation_response;
    let mut simulation_outputs = Vec::new();
    if base_simulations.is_empty() {
        return Err(TrainScheduleError::NoSimulation.into());
    }
    let electrification_ranges_vec = if electrification_ranges.is_empty() {
        vec![None; base_simulations.len()]
    } else {
        electrification_ranges
            .iter()
            .map(|er| Some(er.clone()))
            .collect()
    };
    let power_restriction_ranges_vec = if power_restriction_ranges.is_empty() {
        vec![None; base_simulations.len()]
    } else {
        power_restriction_ranges
            .iter()
            .map(|prr| Some(prr.clone()))
            .collect()
    };
    for (
        base_simulation,
        eco_simulation,
        speed_limits,
        electrification_ranges,
        power_restriction_ranges,
    ) in izip!(
        base_simulations,
        eco_simulations,
        speed_limits,
        electrification_ranges_vec,
        power_restriction_ranges_vec
    ) {
        let eco_simulation = match eco_simulation {
            Some(eco) => Some(Some(DieselJson(eco))),
            None => Some(None),
        };
        let simulation_output = SimulationOutputChangeset {
            id: None,
            mrsp: Some(speed_limits),
            base_simulation: Some(DieselJson(base_simulation)),
            eco_simulation,
            electrification_ranges,
            power_restriction_ranges,
            train_schedule_id: Some(None), // To be filled once the train schedule is inserted
        };
        simulation_outputs.push(simulation_output);
    }
    Ok(simulation_outputs)
}

fn scenario_from_timetable(timetable: &Timetable, db_pool: Data<DbPool>) -> Result<Scenario> {
    use crate::tables::osrd_infra_scenario::dsl::*;
    use diesel::prelude::*;
    match osrd_infra_scenario
        .filter(timetable_id.eq(timetable.id.unwrap()))
        .get_result(&mut db_pool.get()?)
    {
        Ok(scenario) => Ok(scenario),
        Err(diesel::result::Error::NotFound) => panic!("Timetables should have a scenario"),
        Err(err) => Err(err.into()),
    }
}
