use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::core::conflicts::ConflicDetectionRequest;
use crate::core::conflicts::TrainRequirements;
use crate::core::v2::conflict_detection::ConflictType;
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::models::Retrieve;
use crate::models::SimulationOutput;
use crate::models::Timetable;
use crate::models::TimetableWithSchedulesDetails;
use crate::models::TrainSchedule;
use crate::views::train_schedule::TrainScheduleError;
use crate::AppState;
use editoast_models::DbConnectionPoolV2;

mod import;

crate::routes! {
    "/timetable/{id}" => {
        get,
        "/conflicts" => get_conflicts,
        &import,
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
    get, path = "",
    tag = "timetable",
    params(
        ("id" = u64, Path, description = "Timetable id"),
    ),
    responses(
        (status = 200, description = "Timetable with schedules", body = TimetableWithSchedulesDetails),
        (status = 404, description = "Timetable not found"),
    ),
)]
async fn get(
    app_state: State<AppState>,
    Path(timetable_id): Path<i64>,
) -> Result<Json<TimetableWithSchedulesDetails>> {
    let db_pool = app_state.db_pool_v2.clone();
    // Return the timetable
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
    get, path = "",
    tag = "timetable",
    params(
        ("id" = u64, Path, description = "Timetable id"),
    ),
    responses(
        (status = 200, description = "Spacing conflicts", body = Vec<Conflict>),
    ),
)]
async fn get_conflicts(
    Path(timetable_id): Path<i64>,
    State(AppState {
        db_pool_v2: db_pool,
        core_client,
        ..
    }): State<AppState>,
) -> Result<Json<Vec<Conflict>>> {
    let (schedules, simulations) =
        get_simulated_schedules_from_timetable(timetable_id, db_pool).await?;

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
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
