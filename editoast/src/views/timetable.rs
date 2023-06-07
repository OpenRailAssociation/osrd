use std::collections::HashMap;

use crate::error::Result;
use crate::models::{Retrieve, SimulationOutput, Timetable, TimetableWithSchedules};
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
) -> Result<Json<TimetableWithSchedules>> {
    let timetable_id = timetable_id.into_inner();

    // Return the timetable
    let timetable = match Timetable::retrieve(db_pool.clone(), timetable_id).await? {
        Some(timetable) => timetable,
        None => return Err(TimetableError::NotFound { timetable_id }.into()),
    };
    let timetable_with_schedules = timetable.with_train_schedules(db_pool).await?;
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

// This is a dummy implementation for now
#[get("conflicts")]
async fn get_conflicts(
    db_pool: Data<DbPool>,
    timetable_id: Path<i64>,
) -> Result<Json<Vec<Conflict>>> {
    let timetable_id = timetable_id.into_inner();

    // Return the timetable
    let timetable = match Timetable::retrieve(db_pool.clone(), timetable_id).await? {
        Some(timetable) => timetable,
        None => return Err(TimetableError::NotFound { timetable_id }.into()),
    };
    let timetable_with_schedules = timetable.with_train_schedules(db_pool.clone()).await?;

    let mut simulation_outputs = vec![];
    for train_schedule in timetable_with_schedules.train_schedules.iter() {
        let db_pool2 = db_pool.clone();
        let train_schedule_id = train_schedule.id;
        simulation_outputs.push(
            block::<_, Result<_>>(move || {
                use crate::tables::osrd_infra_simulationoutput::dsl;
                use diesel::prelude::*;
                let mut conn = db_pool2.get()?;
                let mut sim_outputs: Vec<SimulationOutput> = dsl::osrd_infra_simulationoutput
                    .filter(dsl::train_schedule_id.eq(train_schedule_id))
                    .load(&mut conn)?;
                if sim_outputs.is_empty() {
                    return Err(
                        TrainScheduleError::UnsimulatedTrainSchedule { train_schedule_id }.into(),
                    );
                }
                assert!(sim_outputs.len() == 1);
                Ok(sim_outputs.remove(0))
            })
            .await
            .unwrap()?, // FIXME: maybe this should be converted to an editoast error?
        );
    }

    #[derive(Debug, Clone)]
    struct TrainRequirement<'a> {
        train_id: i64,
        train_name: &'a str,
        begin: f64,
        end: f64,
    }
    let mut zone_requirements: HashMap<String, Vec<TrainRequirement>> = HashMap::new();

    for (i, simulation_output) in simulation_outputs.into_iter().enumerate() {
        let result_train = simulation_output
            .eco_simulation
            .unwrap_or(simulation_output.base_simulation);
        for requirement in result_train.0.spacing_requirements {
            let ts = &timetable_with_schedules.train_schedules[i];
            zone_requirements
                .entry(requirement.zone)
                .or_insert(vec![])
                .push(TrainRequirement {
                    train_id: ts.id,
                    train_name: &ts.train_name,
                    begin: requirement.begin_time + ts.departure_time,
                    end: requirement.end_time + ts.departure_time,
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
        }); // FIXME: assert this in core
        let mut current_conflict = vec![];
        let mut current_req_end_time = requirements[0].end;
        for (last_requirement, requirement) in requirements.iter().tuple_windows() {
            if requirement.begin < current_req_end_time {
                if current_conflict.is_empty() {
                    current_conflict.push(last_requirement.clone());
                }
                current_conflict.push(requirement.clone());
            } else if !current_conflict.is_empty() {
                conflicts.push(std::mem::take(&mut current_conflict));
            }

            current_req_end_time = requirement.end;
        }

        if !current_conflict.is_empty() {
            conflicts.push(std::mem::take(&mut current_conflict));
        }
    }

    let conflicts = conflicts
        .into_iter()
        .map(|conflict| {
            let start_time = conflict[0].begin.round() as u64; // FIXME: those aren't actually the conflict times
            let end_time = conflict.last().unwrap().end.round() as u64;

            let (train_ids, train_names) = conflict
                .into_iter()
                .map(|req| (req.train_id, req.train_name.to_owned()))
                .unzip();

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
