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
    db_pool: Data<DbConnectionPoolV2>,
    timetable_id: Path<i64>,
) -> Result<Json<TimetableWithSchedulesDetails>> {
    let timetable_id = timetable_id.into_inner();

    // Return the timetable
    let db_pool = db_pool.into_inner();
    let timetable =
        match Timetable::retrieve_conn(db_pool.get().await?.deref_mut(), timetable_id).await? {
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
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use std::ops::DerefMut;

    use crate::models::train_schedule::TrainScheduleValidation;
    use crate::models::Identifiable;
    use crate::models::TimetableWithSchedulesDetails;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::fixtures::create_pathfinding;
    use crate::modelsv2::fixtures::create_project;
    use crate::modelsv2::fixtures::create_scenario_v1;
    use crate::modelsv2::fixtures::create_simulation_output;
    use crate::modelsv2::fixtures::create_study;
    use crate::modelsv2::fixtures::create_timetable_v1;
    use crate::modelsv2::fixtures::create_train_schedule_v1;
    use crate::modelsv2::fixtures::rolling_stock_with_energy_sources_form;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn newer_rolling_stock_version() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let test_name = "newer_rolling_stock_version";
        let project = create_project(db_pool.get_ok().deref_mut(), test_name).await;
        let study = create_study(db_pool.get_ok().deref_mut(), test_name, project.id).await;
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let timetable = create_timetable_v1(db_pool.get_ok().deref_mut(), test_name).await;
        let _ = create_scenario_v1(
            db_pool.get_ok().deref_mut(),
            test_name,
            study.id,
            timetable.get_id(),
            infra.id,
        )
        .await;
        let rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), test_name).await;
        let pathfinding = create_pathfinding(db_pool.get_ok().deref_mut(), infra.id).await;
        let train_schedule = create_train_schedule_v1(
            db_pool.get_ok().deref_mut(),
            pathfinding.id,
            timetable.get_id(),
            rolling_stock.id,
        )
        .await;
        let _ = create_simulation_output(db_pool.get_ok().deref_mut(), train_schedule.id).await;

        // patch rolling_stock
        let patch_rolling_stock_form = rolling_stock_with_energy_sources_form(
            format!("{test_name}_newer_rolling_stock_version").as_str(),
        );

        // WHEN
        let request = TestRequest::patch()
            .uri(format!("/rolling_stock/{}", rolling_stock.id).as_str())
            .set_json(patch_rolling_stock_form)
            .to_request();
        app.fetch(request).assert_status(StatusCode::OK);

        // get the timetable
        let request = TestRequest::get()
            .uri(format!("/timetable/{}", timetable.get_id()).as_str())
            .to_request();

        // THEN
        let response: TimetableWithSchedulesDetails =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let invalid_reasons = &response
            .train_schedule_summaries
            .first()
            .unwrap()
            .invalid_reasons;
        assert!(invalid_reasons
            .iter()
            .any(|i| i == &TrainScheduleValidation::NewerRollingStock))
    }
}
