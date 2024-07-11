use derivative::Derivative;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use futures::future::try_join_all;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;

use super::train_schedule::TrainScheduleValidation;
use super::Scenario;
use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::models::train_schedule::MechanicalEnergyConsumedBaseEco;
use crate::models::train_schedule::TrainSchedule;
use crate::models::train_schedule::TrainScheduleSummary;
use crate::models::SimulationOutput;
use crate::modelsv2::LightRollingStockModel;
use crate::modelsv2::Retrieve;
use crate::tables::timetable;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;

editoast_common::schemas! {
    Timetable,
    TimetableWithSchedulesDetails,
}

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
    ToSchema,
)]
#[derivative(Default)]
#[model(table = "timetable")]
#[model(create, delete, retrieve)]
#[diesel(table_name = timetable)]
pub struct Timetable {
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    #[schema(value_type = String)]
    pub name: Option<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize, ToSchema)]
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
    /// some information about the simulation result
    pub async fn with_detailed_train_schedules(
        self,
        db_pool: Arc<DbConnectionPool>,
    ) -> Result<TimetableWithSchedulesDetails> {
        use crate::tables::infra::dsl as infra_dsl;
        use crate::tables::scenario::dsl as scenario_dsl;
        let mut conn = db_pool.get().await?;
        let infra_version = scenario_dsl::scenario
            .filter(scenario_dsl::timetable_id.eq(self.id.unwrap()))
            .inner_join(infra_dsl::infra)
            .select(infra_dsl::version)
            .first::<String>(&mut conn)
            .await
            .unwrap();

        let train_schedules_with_simulations =
            get_timetable_train_schedules_with_simulations(self.id.unwrap(), db_pool.clone())
                .await?;
        let train_schedule_summaries = train_schedules_with_simulations
            .iter()
            .map(|(train_schedule, simulation_output)| {
                (train_schedule, simulation_output, db_pool.get())
            })
            .map(|(train_schedule, simulation_output, future_conn)| async {
                let mut conn = future_conn.await?;
                let rolling_stock =
                    LightRollingStockModel::retrieve(&mut conn, train_schedule.rolling_stock_id);

                let result_train = &simulation_output.base_simulation.0;
                let result_train_eco = &simulation_output.eco_simulation;
                let eco = result_train_eco
                    .as_ref()
                    .map(|eco| eco.0.mechanical_energy_consumed);
                let mechanical_energy_consumed = MechanicalEnergyConsumedBaseEco {
                    base: result_train.mechanical_energy_consumed,
                    eco,
                };

                let arrival_time = if let Some(eco) = result_train_eco {
                    eco.0.head_positions.last()
                } else {
                    result_train.head_positions.last()
                }
                .expect("Train should have at least one position")
                .time
                    + train_schedule.departure_time;

                let path_length = result_train.stops.last().unwrap().position;
                let stops_count = result_train
                    .stops
                    .iter()
                    .filter(|stop| stop.duration > 0.)
                    .count() as i64;

                let rolling_stock_version = rolling_stock.await?.unwrap().version;
                let invalid_reasons = check_train_validity(
                    &train_schedule.infra_version.clone().unwrap(),
                    train_schedule.rollingstock_version.unwrap(),
                    &infra_version,
                    rolling_stock_version,
                );

                let result: Result<_> = Ok(TrainScheduleSummary {
                    train_schedule: train_schedule.clone(),
                    arrival_time,
                    mechanical_energy_consumed,
                    stops_count,
                    path_length,
                    invalid_reasons,
                });

                result
            })
            .collect::<Vec<_>>();
        let train_schedule_summaries = try_join_all(train_schedule_summaries).await?;
        Ok(TimetableWithSchedulesDetails {
            timetable: self,
            train_schedule_summaries,
        })
    }

    /// Retrieves the associated train schedules
    pub async fn get_train_schedules(
        &self,
        db_pool: Arc<DbConnectionPool>,
    ) -> Result<Vec<TrainSchedule>> {
        get_timetable_train_schedules(self.id.unwrap(), db_pool).await
    }

    /// Get infra_version from timetable
    pub async fn infra_version_from_timetable(&self, conn: &mut DbConnection) -> String {
        use crate::tables::infra::dsl as infra_dsl;
        use crate::tables::scenario::dsl as scenario_dsl;
        let timetable_id = self.id.unwrap();
        scenario_dsl::scenario
            .filter(scenario_dsl::timetable_id.eq(timetable_id))
            .inner_join(infra_dsl::infra)
            .select(infra_dsl::version)
            .first::<String>(conn)
            .await
            .expect("could not retrieve the version of the infra of a scenario using its timetable")
    }

    /// Retrieve the associated scenario
    pub async fn get_scenario_conn(&self, conn: &mut DbConnection) -> Result<Scenario> {
        use crate::tables::scenario::dsl::*;
        let self_id = self.id.expect("Timetable should have an id");
        match scenario
            .filter(timetable_id.eq(self_id))
            .get_result(conn)
            .await
        {
            Ok(scenario_obj) => Ok(scenario_obj),
            Err(diesel::result::Error::NotFound) => panic!("Timetables should have a scenario"),
            Err(err) => Err(err.into()),
        }
    }

    /// Retrieve the associated scenario
    pub async fn get_scenario(&self, db_pool: Arc<DbConnectionPool>) -> Result<Scenario> {
        let mut conn = db_pool.get().await.unwrap();
        self.get_scenario_conn(&mut conn).await
    }
}

pub async fn get_timetable_train_schedules(
    timetable_id: i64,
    db_pool: Arc<DbConnectionPool>,
) -> Result<Vec<TrainSchedule>> {
    use crate::tables::train_schedule;
    let mut conn = db_pool.get().await?;
    Ok(train_schedule::table
        .filter(train_schedule::timetable_id.eq(timetable_id))
        .order_by(train_schedule::departure_time)
        .load(&mut conn)
        .await?)
}

pub async fn get_timetable_train_schedules_with_simulations(
    timetable_id: i64,
    db_pool: Arc<DbConnectionPool>,
) -> Result<Vec<(TrainSchedule, SimulationOutput)>> {
    let train_schedules = get_timetable_train_schedules(timetable_id, db_pool.clone()).await?;

    let mut conn = db_pool.get().await?;
    let simulation_outputs = SimulationOutput::belonging_to(&train_schedules)
        .load::<SimulationOutput>(&mut conn)
        .await?;
    let mut output_map: HashMap<_, _> = simulation_outputs
        .into_iter()
        .map(|o| (o.train_schedule_id.unwrap(), o))
        .collect();
    let result: Vec<(TrainSchedule, SimulationOutput)> = train_schedules
        .into_iter()
        .filter_map(|schedule| {
            schedule
                .id
                .and_then(|id| output_map.remove(&id))
                .map(|output| (schedule, output))
        })
        .collect();
    Ok(result)
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
