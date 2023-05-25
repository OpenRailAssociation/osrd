use crate::error::Result;
use crate::models::{Retrieve, Timetable, TimetableWithSchedules};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, Data, Json, Path};
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
struct Conflict {
    train_ids: Vec<i64>,
    train_names: Vec<String>,
    start_time: u64,
    end_time: u64,
    conflict_type: String,
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
    let timetable_with_schedules = timetable.with_train_schedules(db_pool).await?;

    if timetable_with_schedules.train_schedules.len() < 2 {
        return Ok(Json(vec![]));
    }

    let (train_ids, train_names) = timetable_with_schedules
        .train_schedules
        .into_iter()
        .take(2)
        .map(|ts| (ts.id, ts.train_name))
        .unzip();
    let conflict = Conflict {
        train_ids,
        train_names,
        start_time: 173,
        end_time: 1036,
        conflict_type: "Spacing".to_owned(),
    };
    let conflict2 = conflict.clone();
    Ok(Json(vec![conflict, conflict2]))
}
