use std::collections::HashMap;

use crate::core::conflicts::{ConflicDetectionRequest, TrainRequirement};
use crate::core::{AsCoreRequest, CoreClient};
use crate::error::Result;
use crate::models::{
    Retrieve, SimulationOutput, SpacingRequirement, Timetable, TimetableWithSchedulesDetails,
    TrainSchedule,
};
use crate::views::train_schedule::TrainScheduleError;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, block, Data, Json, Path};
use editoast_derive::EditoastError;
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
pub enum ConflictType {
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
    core_client: Data<CoreClient>,
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

    let mut id_to_name = HashMap::new();
    let mut trains_requirements = Vec::new();
    for (schedule, simulation) in schedules.into_iter().zip(simulations.into_iter()) {
        id_to_name.insert(
            schedule.id.expect("TrainSchedule should have an id"),
            schedule.train_name,
        );

        let result_train = simulation
            .eco_simulation
            .unwrap_or(simulation.base_simulation)
            .0;

        let spacing_requirements = result_train
            .spacing_requirements
            .into_iter()
            .map(|sr| SpacingRequirement {
                zone: sr.zone,
                begin_time: sr.begin_time + schedule.departure_time,
                end_time: sr.end_time + schedule.departure_time,
            })
            .collect();

        trains_requirements.push(TrainRequirement {
            train_id: schedule.id.expect("TrainSchedule should have an id"),
            spacing_requirements,
        })
    }

    let request = ConflicDetectionRequest {
        trains_requirements,
    };
    let response = request.fetch(&core_client).await?;

    let conflicts = response
        .conflicts
        .into_iter()
        .map(|conflict| {
            let train_names = conflict
                .train_ids
                .iter()
                .map(|id| {
                    id_to_name
                        .get(id)
                        .expect("Train id should be in id_to_name")
                })
                .cloned()
                .collect();
            Conflict {
                train_ids: conflict.train_ids,
                train_names,
                start_time: conflict.start_time.round() as u64,
                end_time: conflict.end_time.round() as u64,
                conflict_type: conflict.conflict_type,
            }
        })
        .collect();

    Ok(Json(conflicts))
}

#[cfg(test)]
pub mod test {

    use actix_http::StatusCode;
    use actix_web::test::{call_service, TestRequest};
    use rstest::rstest;

    use crate::{
        assert_status_and_read,
        fixtures::tests::{
            train_with_simulation_output_fixture_set, TrainScheduleWithSimulationOutputFixtureSet,
        },
        models::{
            rolling_stock::tests::get_other_rolling_stock, train_schedule::TrainScheduleValidation,
            TimetableWithSchedulesDetails,
        },
        views::tests::create_test_service,
    };

    #[rstest]
    async fn newer_rolling_stock_version(
        #[future] train_with_simulation_output_fixture_set: TrainScheduleWithSimulationOutputFixtureSet,
    ) {
        let app = create_test_service().await;

        let train_with_simulation_output = train_with_simulation_output_fixture_set.await;

        let rolling_stock_id = train_with_simulation_output
            .train_schedule
            .model
            .rolling_stock_id;
        // patch rolling_stock
        let mut patch_rolling_stock = get_other_rolling_stock();
        patch_rolling_stock.id = Some(rolling_stock_id);
        call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(&patch_rolling_stock)
                .to_request(),
        )
        .await;

        // get the timetable
        let response = call_service(
            &app,
            TestRequest::get()
                .uri(
                    format!(
                        "/timetable/{}",
                        train_with_simulation_output
                            .train_schedule
                            .model
                            .timetable_id
                    )
                    .as_str(),
                )
                .to_request(),
        )
        .await;

        let response_body: TimetableWithSchedulesDetails =
            assert_status_and_read!(response, StatusCode::OK);
        let invalid_reasons = &response_body
            .train_schedule_summaries
            .first()
            .unwrap()
            .invalid_reasons;
        assert!(invalid_reasons
            .iter()
            .any(|i| i == &TrainScheduleValidation::NewerRollingStock))
    }
}
