use std::collections::HashMap;

use crate::error::Result;
use crate::models::{
    Retrieve, SimulationOutput, Timetable, TimetableWithSchedulesDetails, TrainSchedule,
};
use crate::views::train_schedule::TrainScheduleError;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, block, Data, Json, Path};
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/timetable/{timetable_id}").service((get, get_conflicts))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "timetable")]
enum TimetableError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { timetable_id: i64 },
}

/// Return a specific timetable with its associated schedules
#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    timetable_id: Path<i64>,
) -> Result<Json<TimetableWithSchedulesDetails>> {
    let timetable_id = timetable_id.into_inner();

    // Return the timetable
    let timetable = match Timetable::retrieve(db_pool.clone(), timetable_id).await? {
        Some(timetable) => timetable,
        None => return Err(TimetableError::NotFound { timetable_id }.into()),
    };
    let timetable_with_schedules = timetable.with_detailed_train_schedules(db_pool).await?;
    Ok(Json(timetable_with_schedules))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum ConflictType {
    Spacing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Conflict {
    train_ids: Vec<i64>,
    train_names: Vec<String>,
    start_time: u64,
    end_time: u64,
    conflict_type: ConflictType,
}

/// This is a dummy implementation for now
#[get("conflicts")]
async fn get_conflicts(
    db_pool: Data<DbPool>,
    timetable_id: Path<i64>,
) -> Result<Json<Vec<Conflict>>> {
    let timetable_id = timetable_id.into_inner();

    let db_pool2 = db_pool.clone();
    let (schedules, simulations): (Vec<TrainSchedule>, Vec<SimulationOutput>) =
        block::<_, Result<_>>(move || {
            let mut conn = db_pool2.get()?;
            use crate::tables::osrd_infra_trainschedule;
            use diesel::prelude::*;

            let train_schedules = osrd_infra_trainschedule::table
                .filter(osrd_infra_trainschedule::timetable_id.eq(timetable_id))
                .load::<TrainSchedule>(&mut conn)?;

            let simulation_outputs = SimulationOutput::belonging_to(&train_schedules)
                .load::<SimulationOutput>(&mut conn)?;

            simulation_outputs
                .grouped_by(&train_schedules)
                .into_iter()
                .zip(train_schedules)
                .map(|(mut sim_output, train_schedule)| {
                    if sim_output.is_empty() {
                        return Err(TrainScheduleError::UnsimulatedTrainSchedule {
                            train_schedule_id: train_schedule
                                .id
                                .expect("TrainSchedule should have an id"),
                        }
                        .into());
                    }
                    assert!(sim_output.len() == 1);
                    Ok((train_schedule, sim_output.remove(0)))
                })
                .collect::<Result<Vec<(TrainSchedule, SimulationOutput)>>>()
                .map(|v| v.into_iter().unzip())
        })
        .await
        .unwrap()?; // FIXME: maybe this should be converted to an editoast error?

    #[derive(Debug, Clone)]
    struct TrainRequirement<'a> {
        train_id: i64,
        train_name: &'a str,
        begin: f64,
        end: f64,
    }
    let mut zone_requirements: HashMap<String, Vec<TrainRequirement>> = HashMap::new();

    for (train_schedule, simulation) in schedules.iter().zip(simulations) {
        let result_train = simulation
            .eco_simulation
            .unwrap_or(simulation.base_simulation);
        for requirement in result_train.0.spacing_requirements {
            zone_requirements
                .entry(requirement.zone)
                .or_insert(vec![])
                .push(TrainRequirement {
                    train_id: train_schedule.id.expect("TrainSchedule should have an id"),
                    train_name: &train_schedule.train_name,
                    begin: requirement.begin_time + train_schedule.departure_time,
                    end: requirement.end_time + train_schedule.departure_time,
                })
        }
    }

    let mut conflicts = vec![];

    for (_, mut requirements) in zone_requirements {
        if requirements.len() < 2 {
            continue;
        }
        requirements.sort_by(|a, b| {
            a.begin
                .partial_cmp(&b.begin)
                .expect("Requirements should not contain NaN")
        });

        for (last_requirement, requirement) in requirements.iter().tuple_windows() {
            if requirement.begin < last_requirement.end {
                conflicts.push((last_requirement.clone(), requirement.clone()));
            }
        }
    }

    let conflicts = conflicts
        .into_iter()
        .map(|conflict| {
            let start_time = conflict.1.begin.round() as u64;
            let end_time = conflict.0.end.round() as u64;

            let train_ids = vec![conflict.0.train_id, conflict.1.train_id];
            let train_names = vec![
                conflict.0.train_name.to_owned(),
                conflict.1.train_name.to_owned(),
            ];

            Conflict {
                train_ids,
                train_names,
                start_time,
                end_time,
                conflict_type: ConflictType::Spacing,
            }
        })
        .collect::<Vec<_>>();

    Ok(Json(conflicts))
}
