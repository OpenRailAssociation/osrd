use crate::diesel::QueryDsl;
use crate::error::Result;
use crate::models::{
    train_schedule::{
        LightTrainSchedule, MechanicalEnergyConsumedBaseEco, TrainSchedule, TrainScheduleSummary,
    },
    SimulationOutput,
};
use crate::tables::osrd_infra_timetable;
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
        let train_schedule_summaries =
            get_timetable_train_schedules_with_simulations(self.id.unwrap(), db_pool.clone())
                .await?
                .iter()
                .map(|(train_schedule, simulation_output)| {
                    let result_train = &simulation_output.base_simulation.0;
                    let result_train_eco = &simulation_output.eco_simulation;
                    let arrival_time = result_train
                        .head_positions
                        .last()
                        .expect("Train should have at least one position")
                        .time
                        + train_schedule.departure_time;
                    let eco = result_train_eco
                        .as_ref()
                        .map(|eco| eco.0.mechanical_energy_consumed);
                    let mechanical_energy_consumed = MechanicalEnergyConsumedBaseEco {
                        base: result_train.mechanical_energy_consumed,
                        eco,
                    };
                    let path_length = result_train.stops.last().unwrap().position;
                    let stops_count = result_train
                        .stops
                        .iter()
                        .filter(|stop| stop.duration > 0.)
                        .count() as i64;

                    TrainScheduleSummary {
                        train_schedule: train_schedule.clone(),
                        arrival_time,
                        mechanical_energy_consumed,
                        stops_count,
                        path_length,
                    }
                })
                .collect::<Vec<TrainScheduleSummary>>();
        Ok(TimetableWithSchedulesDetails {
            timetable: self,
            train_schedule_summaries,
        })
    }

    /// Retrieves the associated train schedules
    pub async fn get_train_schedules(&self, db_pool: Data<DbPool>) -> Result<Vec<TrainSchedule>> {
        get_timetable_train_schedules(self.id.unwrap(), db_pool).await
    }
}

pub async fn get_timetable_train_schedules(
    timetable_id: i64,
    db_pool: Data<DbPool>,
) -> Result<Vec<TrainSchedule>> {
    use crate::tables::osrd_infra_trainschedule;
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        Ok(osrd_infra_trainschedule::table
            .filter(osrd_infra_trainschedule::timetable_id.eq(timetable_id))
            .load(&mut conn)?)
    })
    .await
    .unwrap()
}

pub async fn get_timetable_train_schedules_with_simulations(
    timetable_id: i64,
    db_pool: Data<DbPool>,
) -> Result<Vec<(TrainSchedule, SimulationOutput)>> {
    let train_schedules = get_timetable_train_schedules(timetable_id, db_pool.clone()).await?;

    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;

        let simulation_outputs =
            SimulationOutput::belonging_to(&train_schedules).load::<SimulationOutput>(&mut conn)?;

        let result = train_schedules
            .into_iter()
            .zip(simulation_outputs.into_iter())
            .collect();

        Ok(result)
    })
    .await
    .unwrap()
}
