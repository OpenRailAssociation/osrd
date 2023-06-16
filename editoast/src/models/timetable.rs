use crate::diesel::QueryDsl;
use crate::error::Result;
use crate::models::train_schedule::{
    LightTrainSchedule, MechanicalEnergyConsumedBaseEco, TrainSchedule, TrainScheduleSummary,
};
use crate::models::ResultStops;
use crate::tables::osrd_infra_timetable;
use crate::views::train_schedule::simulation_report::fetch_simulation_output;
use crate::DbPool;
use actix_web::web::{block, Data};
use derivative::Derivative;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Debug,
    PartialEq,
    Queryable,
    Identifiable,
    Serialize,
    Selectable,
    Model,
    Derivative,
    Insertable,
    Deserialize,
)]
#[derivative(Default)]
#[model(table = "osrd_infra_timetable")]
#[model(create, delete, retrieve)]
#[diesel(table_name = osrd_infra_timetable)]
pub struct Timetable {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct TimetableWithSchedulesDetails {
    #[serde(flatten)]
    pub timetable: Timetable,
    pub train_schedule_summaries: Vec<TrainScheduleSummary>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct TimetableWithSchedules {
    pub timetable: Timetable,
    pub train_schedules: Vec<LightTrainSchedule>,
}

impl crate::models::Identifiable for Timetable {
    fn get_id(&self) -> i64 {
        self.id.unwrap()
    }
}

impl Timetable {
    /// Retrieves timetable with a specific id, its associated train schedules details and
    /// some informations about the simulation result
    pub async fn with_detailed_train_schedules(
        self,
        db_pool: Data<DbPool>,
    ) -> Result<TimetableWithSchedulesDetails> {
        use crate::tables::osrd_infra_trainschedule::dsl;
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.get()?;
            let train_schedules: Vec<TrainSchedule> = dsl::osrd_infra_trainschedule
                .filter(dsl::timetable_id.eq(self.id.unwrap()))
                .load(&mut conn)?;
            let train_schedules: Vec<TrainScheduleSummary> = train_schedules
                .into_iter()
                .map(|train_schedule| {
                    let simulation_output =
                        fetch_simulation_output(&train_schedule, &mut conn).unwrap();
                    let result_train = simulation_output.base_simulation.0;
                    let result_train_eco = simulation_output.eco_simulation;
                    let arrival_time = result_train
                        .head_positions
                        .last()
                        .expect("Train should have at least one position")
                        .time
                        + train_schedule.departure_time;
                    let eco = result_train_eco.map(|eco| eco.0.mechanical_energy_consumed);
                    let mechanical_energy_consumed = MechanicalEnergyConsumedBaseEco {
                        base: result_train.mechanical_energy_consumed,
                        eco,
                    };
                    let filtered_stops: Vec<ResultStops> = result_train
                        .stops
                        .into_iter()
                        .filter(|stop| stop.duration > 0.)
                        .collect();
                    let path_length = filtered_stops.last().unwrap().position;
                    let stops = filtered_stops.len() - 1;

                    TrainScheduleSummary {
                        train_schedule,
                        arrival_time,
                        mechanical_energy_consumed,
                        stops_count: stops as i64,
                        path_length,
                    }
                })
                .collect();
            Ok(TimetableWithSchedulesDetails {
                timetable: self,
                train_schedule_summaries: train_schedules,
            })
        })
        .await
        .unwrap()
    }

    /// Retrieves the associated train schedules
    pub async fn get_train_schedules(&self, db_pool: Data<DbPool>) -> Result<Vec<TrainSchedule>> {
        use crate::tables::osrd_infra_trainschedule::dsl;
        let timetable_id = self.id.unwrap();
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.get()?;
            Ok(dsl::osrd_infra_trainschedule
                .filter(dsl::timetable_id.eq(timetable_id))
                .load(&mut conn)?)
        })
        .await
        .unwrap()
    }
}
