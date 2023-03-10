use super::{Retrieve, TrainSchedule};
use crate::error::Result;
use crate::tables::osrd_infra_timetable;
use diesel::pg::PgConnection;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use editoast_derive::Model;
use serde::Serialize;

#[derive(Debug, PartialEq, Queryable, Identifiable, Serialize, Selectable, Model)]
#[model(table = "osrd_infra_timetable")]
#[model(retrieve)]
#[diesel(table_name = osrd_infra_timetable)]
pub struct Timetable {
    #[diesel(deserialize_as = i64)]
    pub id: i64,
    #[diesel(deserialize_as = String)]
    pub name: String,
}

impl Timetable {
    /// Retrieves timetable with a specific id and its associated train schedules
    pub fn with_train_schedules(
        conn: &mut PgConnection,
        timetable_id: i64,
    ) -> Result<Option<(Timetable, Vec<TrainSchedule>)>> {
        let timetable = match Timetable::retrieve_conn(conn, timetable_id)? {
            Some(timetable) => timetable,
            None => return Ok(None),
        };

        let train_schedules = TrainSchedule::belonging_to(&timetable)
            .select(TrainSchedule::as_select())
            .load::<TrainSchedule>(conn)?;
        Ok(Some((timetable, train_schedules)))
    }
}
