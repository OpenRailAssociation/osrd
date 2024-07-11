use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Arc;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::core::conflicts::ConflicDetectionRequest;
use crate::core::conflicts::TrainRequirements;
use crate::core::v2::conflict_detection::ConflictType;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::models::Retrieve;
use crate::models::SimulationOutput;
use crate::models::Timetable;
use crate::models::TimetableWithSchedulesDetails;
use crate::models::TrainSchedule;
use crate::views::train_schedule::TrainScheduleError;
use editoast_models::DbConnectionPool;
use editoast_models::DbConnectionPoolV2;

mod import;

crate::routes! {
    "/timetable/{id}" => {
        get,
        get_conflicts,
        import::routes(),
    },
}

editoast_common::schemas! {
    Conflict,
    ConflictType,
    import::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "timetable")]
enum TimetableError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { timetable_id: i64 },
    #[error("Infra '{infra_id}' is not loaded")]
    #[editoast_error(status = 400)]
    InfraNotLoaded { infra_id: i64 },
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    tag = "timetable",
    params(
        ("id" = u64, Path, description = "Timetable id"),
    ),
    responses(
        (status = 200, description = "Timetable with schedules", body = TimetableWithSchedulesDetails),
        (status = 404, description = "Timetable not found"),
    ),
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPool>,
    timetable_id: Path<i64>,
) -> Result<Json<TimetableWithSchedulesDetails>> {
    let timetable_id = timetable_id.into_inner();

    // Return the timetable
    let db_pool = db_pool.into_inner();
    let timetable = match Timetable::retrieve(db_pool.clone(), timetable_id).await? {
        Some(timetable) => timetable,
        None => return Err(TimetableError::NotFound { timetable_id }.into()),
    };
    let timetable_with_schedules = timetable.with_detailed_train_schedules(db_pool).await?;

    Ok(Json(timetable_with_schedules))
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
struct Conflict {
    train_ids: Vec<i64>,
    train_names: Vec<String>,
    start_time: u64,
    end_time: u64,
    conflict_type: ConflictType,
}

pub async fn get_simulated_schedules_from_timetable(
    timetable_id: i64,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(Vec<TrainSchedule>, Vec<SimulationOutput>)> {
    use diesel::BelongingToDsl;
    use diesel::ExpressionMethods;
    use diesel::GroupedBy;
    use diesel::QueryDsl;
    use diesel_async::RunQueryDsl;

    use crate::tables::train_schedule;

    let train_schedules = train_schedule::table
        .filter(train_schedule::timetable_id.eq(timetable_id))
        .load::<TrainSchedule>(db_pool.get().await?.deref_mut())
        .await?;

    SimulationOutput::belonging_to(&train_schedules)
        .load::<SimulationOutput>(db_pool.get().await?.deref_mut())
        .await?
        .grouped_by(&train_schedules)
        .into_iter()
        .zip(train_schedules)
        .map(|(mut sim_output, train_schedule)| {
            if sim_output.is_empty() {
                return Err(TrainScheduleError::UnsimulatedTrainSchedule {
                    train_schedule_id: train_schedule.id.expect("TrainSchedule should have an id"),
                }
                .into());
            }
            assert!(sim_output.len() == 1);
            Ok((train_schedule, sim_output.remove(0)))
        })
        .collect::<Result<Vec<(TrainSchedule, SimulationOutput)>>>()
        .map(|v| v.into_iter().unzip())
}

/// Compute spacing conflicts for a given timetable
/// TODO: This should compute itinary conflicts too
#[utoipa::path(
    tag = "timetable",
    params(
        ("id" = u64, Path, description = "Timetable id"),
    ),
    responses(
        (status = 200, description = "Spacing conflicts", body = Vec<Conflict>),
    ),
)]
#[get("conflicts")]
async fn get_conflicts(
    db_pool: Data<DbConnectionPoolV2>,
    timetable_id: Path<i64>,
    core_client: Data<CoreClient>,
) -> Result<Json<Vec<Conflict>>> {
    let timetable_id = timetable_id.into_inner();

    let (schedules, simulations) =
        get_simulated_schedules_from_timetable(timetable_id, db_pool.into_inner()).await?;

    let mut id_to_name = HashMap::new();
    let mut trains_requirements = Vec::new();
    for (schedule, simulation) in schedules.into_iter().zip(simulations) {
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
            .map(|mut sr| {
                sr.begin_time += schedule.departure_time;
                sr.end_time += schedule.departure_time;
                sr
            })
            .collect();

        let routing_requirements = result_train
            .routing_requirements
            .into_iter()
            .map(|mut rr| {
                rr.begin_time += schedule.departure_time;
                for zone in rr.zones.iter_mut() {
                    zone.end_time += schedule.departure_time;
                }
                rr
            })
            .collect();

        trains_requirements.push(TrainRequirements {
            train_id: schedule.id.expect("TrainSchedule should have an id"),
            spacing_requirements,
            routing_requirements,
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
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::rstest;

    use crate::assert_status_and_read;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::get_other_rolling_stock_form;
    use crate::fixtures::tests::train_with_simulation_output_fixture_set;
    use crate::models::train_schedule::TrainScheduleValidation;
    use crate::models::TimetableWithSchedulesDetails;
    use crate::views::tests::create_test_service;

    #[rstest]
    async fn newer_rolling_stock_version() {
        // GIVEN
        let app = create_test_service().await;

        let train_with_simulation_output =
            train_with_simulation_output_fixture_set("newer_rolling_stock_version", db_pool())
                .await;

        let rolling_stock_id = train_with_simulation_output
            .train_schedule
            .model
            .rolling_stock_id;
        // patch rolling_stock
        let patch_rolling_stock_form =
            get_other_rolling_stock_form("fast_rolling_stock_newer_rolling_stock_version");

        // WHEN
        call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(&patch_rolling_stock_form)
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

        // THEN
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
