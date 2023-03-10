use crate::error::Result;
use crate::models::Timetable;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, block, Data, Json, Path};
use editoast_derive::EditoastError;
use serde::Serialize;
use thiserror::Error;

use super::train_schedule::TrainScheduleDetails;

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

#[derive(Debug, PartialEq, Serialize)]
pub struct TimetableWithSchedules {
    #[serde(flatten)]
    pub timetable: Timetable,
    pub train_schedules: Vec<TrainScheduleDetails>,
}

/// Return a specific timetable with its associated schedules
#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    timetable_id: Path<i64>,
) -> Result<Json<TimetableWithSchedules>> {
    let timetable_id = timetable_id.into_inner();
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(
            match Timetable::with_train_schedules(&mut conn, timetable_id)? {
                Some((timetable, schedules)) => TimetableWithSchedules {
                    timetable,
                    train_schedules: schedules
                        .into_iter()
                        .map(|schedule| schedule.into())
                        .collect(),
                },
                None => return Err(TimetableError::NotFound { timetable_id }.into()),
            },
        ))
    })
    .await
    .unwrap()
}
