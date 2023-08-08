use crate::diesel::QueryDsl;
use crate::error::Result;
use crate::models::LightRollingStockModel;
use crate::models::Retrieve;
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

use super::train_schedule::TrainScheduleValidation;

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

#[derive(Debug, PartialEq, Serialize, Deserialize)]
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
        use crate::tables::osrd_infra_infra::dsl as infra_dsl;
        use crate::tables::osrd_infra_scenario::dsl as scenario_dsl;
        let pool = db_pool.clone();
        let infra_version = block(move || {
            let mut conn = pool.get().unwrap();
            scenario_dsl::osrd_infra_scenario
                .filter(scenario_dsl::timetable_id.eq(self.id.unwrap()))
                .inner_join(infra_dsl::osrd_infra_infra)
                .select(infra_dsl::version)
                .first::<String>(&mut conn)
                .unwrap()
        })
        .await
        .unwrap();
        let train_schedule_summaries =
            get_timetable_train_schedules_with_simulations(self.id.unwrap(), db_pool.clone())
                .await?;
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.clone().get()?;
            let train_schedule_summaries = train_schedule_summaries
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

                    let rolling_stock = LightRollingStockModel::retrieve_conn(
                        &mut conn,
                        train_schedule.rolling_stock_id,
                    )
                    .unwrap();
                    let rolling_stock_version = rolling_stock.unwrap().version;
                    let invalid_reasons = check_train_validity(
                        &train_schedule.infra_version.clone().unwrap(),
                        train_schedule.rollingstock_version.unwrap(),
                        &infra_version,
                        rolling_stock_version,
                    );

                    TrainScheduleSummary {
                        train_schedule: train_schedule.clone(),
                        arrival_time,
                        mechanical_energy_consumed,
                        stops_count,
                        path_length,
                        invalid_reasons,
                    }
                })
                .collect::<Vec<_>>();
            Ok(TimetableWithSchedulesDetails {
                timetable: self,
                train_schedule_summaries,
            })
        })
        .await
        .unwrap()
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
            .zip(simulation_outputs)
            .collect();
        Ok(result)
    })
    .await
    .unwrap()
}

/// Return a list of reasons the train is invalid.
/// An empty list means the train is valid.
pub fn check_train_validity(
    infra_version: &str,
    rollingstock_version: i64,
    current_infra_version: &str,
    current_rolling_stock_version: i64,
) -> Vec<TrainScheduleValidation> {
    let mut invalid_reasons = vec![];
    if infra_version != current_infra_version {
        invalid_reasons.push(TrainScheduleValidation::NewerInfra)
    };
    if rollingstock_version != current_rolling_stock_version {
        invalid_reasons.push(TrainScheduleValidation::NewerRollingStock)
    };
    invalid_reasons
}
