use std::collections::HashSet;

use crate::core::{AsCoreRequest, CoreClient};
use crate::error::{InternalError, Result};
use crate::models::{
    Create, Delete, Pathfinding, Retrieve, RollingStockModel, Scenario, SimulationOutput,
    SimulationOutputChangeset, TrainScheduleChangeset, Update,
};
use crate::models::{Timetable, TrainSchedule};

use crate::DbPool;
use crate::DieselJson;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, scope, Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use diesel::Connection;
use editoast_derive::EditoastError;
use itertools::izip;
use serde_derive::Deserialize;

use crate::core::simulation::{SimulationRequest, SimulationResponse};

use simulation_report::SimulationReport;
use thiserror::Error;

use crate::models::electrical_profile::ElectricalProfileSet;
use futures::executor;

mod projection;
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
}

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/train_schedule")
        .service((get_results, standalone_simulation, delete_multiple))
        .service(scope("/{id}").service((delete, get, patch, get_result)))
}

/// Return a specific timetable with its associated schedules
#[get("{id}")]
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
    #[schema(required)]
    ids: Vec<i64>,
}
//Delete multiple train schedule
#[delete("/delete")]
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
    train_schedules_changeset: Json<Vec<TrainScheduleChangeset>>,
    core: Data<CoreClient>,
) -> Result<HttpResponse> {
    let train_schedules_changeset = train_schedules_changeset.into_inner();
    if train_schedules_changeset.is_empty() {
        return Err(TrainScheduleError::NoTrainSchedules.into());
    }
    let mut conn = db_pool.get()?;
    conn.transaction::<_, InternalError, _>(|conn| {
        let mut train_schedules = Vec::new();
        for changeset in train_schedules_changeset {
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
        let simulation_outputs = process_simulation_response(response_payload);

        for simulation_output in simulation_outputs {
            simulation_output.create_conn(conn)?;
        }
        Ok(())
    })?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Deserialize)]
struct GetResultQuery {
    path_id: i64,
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

    let projection_path_id = query.into_inner().path_id;

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

    let res = simulation_report::create_simulation_report(
        infra,
        train_schedule,
        &projection,
        &projection_path_payload,
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
        let sim_report = simulation_report::create_simulation_report(
            infra,
            schedule,
            &projection,
            &projection_path_payload,
            db_pool.clone(),
            core.as_ref(),
        )
        .await?;
        res.push(sim_report);
    }

    Ok(Json(res))
}

#[post("/standalone_simulation")]
async fn standalone_simulation(
    db_pool: Data<DbPool>,
    train_schedules: Json<Vec<TrainSchedule>>,
    core: Data<CoreClient>,
) -> Result<Json<Vec<i64>>> {
    let train_schedules = train_schedules.into_inner();

    if train_schedules.is_empty() {
        return Err(TrainScheduleError::NoTrainSchedules.into());
    }

    let id_timetable = train_schedules[0].timetable_id;
    if train_schedules
        .iter()
        .any(|ts| ts.timetable_id != id_timetable)
    {
        return Err(TrainScheduleError::BatchShouldHaveSameTimetable.into());
    }

    let timetable = Timetable::retrieve(db_pool.clone(), id_timetable)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound {
            timetable_id: id_timetable,
        })?;

    let scenario = scenario_from_timetable(&timetable, db_pool.clone())?;

    let request_payload =
        create_backend_request_payload(&train_schedules, &scenario, db_pool.clone()).await?;
    let response_payload = request_payload.fetch(core.as_ref()).await?;
    let simulation_outputs = process_simulation_response(response_payload);

    assert_eq!(train_schedules.len(), simulation_outputs.len());

    let mut res_ids = Vec::new();
    let mut conn = db_pool.get()?;
    // Start a transaction
    conn.transaction::<_, InternalError, _>(|conn| {
        // Save inputs
        for train_schedule in train_schedules {
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
    for rolling_stock_id in rolling_stocks_ids {
        let rolling_stock = RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id)
            .await?
            .ok_or(TrainScheduleError::RollingStockNotFound { rolling_stock_id })?;
        rolling_stocks.push(rolling_stock.into());
    }
    let path = Pathfinding::retrieve(db_pool.clone(), train_schedules[0].path_id)
        .await?
        .ok_or_else(|| TrainScheduleError::PathNotFound {
            path_id: train_schedules[0].path_id,
        })?
        .into();

    let electrical_profile_set = match scenario.electrical_profile_set_id {
        Some(Some(id)) => {
            let mut conn = db_pool.get()?;
            let eps = ElectricalProfileSet::retrieve(&mut conn, id)?;
            eps.name
        }
        _ => None,
    };

    Ok(SimulationRequest {
        infra,
        rolling_stocks,
        train_schedules: train_schedules.to_owned(),
        electrical_profile_set,
        trains_path: path,
    })
}

fn process_simulation_response(
    response_payload: SimulationResponse,
) -> Vec<SimulationOutputChangeset> {
    let mut simulation_outputs = Vec::new();
    for (
        base_simulation,
        eco_simulation,
        speed_limits,
        electrification_ranges,
        power_restriction_ranges,
    ) in izip!(
        response_payload.base_simulations,
        response_payload.eco_simulations,
        response_payload.speed_limits,
        response_payload.electrification_ranges,
        response_payload.power_restriction_ranges
    ) {
        let simulation_output = SimulationOutputChangeset {
            id: None,
            mrsp: Some(speed_limits),
            base_simulation: Some(DieselJson(base_simulation)),
            eco_simulation: Some(Some(DieselJson(eco_simulation))),
            electrification_ranges: Some(electrification_ranges),
            power_restriction_ranges: Some(power_restriction_ranges),
            train_schedule_id: None, // To be filled once the train schedule is inserted
        };
        simulation_outputs.push(simulation_output);
    }
    simulation_outputs
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
