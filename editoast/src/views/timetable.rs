use crate::error::Result;
use crate::models::{Retrieve, Timetable, TimetableWithSchedules};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, Data, Json, Path};
use editoast_derive::EditoastError;
use thiserror::Error;

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/timetable/{timetable_id}").service(get)
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
