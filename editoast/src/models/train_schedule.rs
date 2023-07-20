use std::collections::HashMap;

use crate::tables::osrd_infra_trainschedule;
use crate::DieselJson;
use crate::{
    models::{Identifiable, Timetable},
    tables::osrd_infra_simulationoutput,
};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::RunQueryDsl;
use serde_json::Value as JsonValue;

use diesel::prelude::*;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Associations,
    Clone,
    Debug,
    Deserialize,
    Derivative,
    Identifiable,
    Insertable,
    Model,
    PartialEq,
    Queryable,
    Selectable,
    Serialize,
)]
#[model(table = "osrd_infra_trainschedule")]
#[model(create, delete, retrieve)]
#[diesel(belongs_to(Timetable))]
#[diesel(table_name = osrd_infra_trainschedule)]
#[derivative(Default)]
pub struct TrainSchedule {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    pub train_name: String,
    pub labels: JsonValue,
    pub departure_time: f64,
    pub initial_speed: f64,
    #[derivative(Default(value = "DieselJson(Default::default())"))]
    pub allowances: DieselJson<Vec<Allowance>>,
    #[derivative(Default(value = "DieselJson(Default::default())"))]
    pub scheduled_points: DieselJson<Vec<ScheduledPoint>>,
    #[diesel(deserialize_as = String)]
    pub comfort: String,
    pub speed_limit_tags: Option<String>,
    pub power_restriction_ranges: Option<JsonValue>,
    pub options: Option<JsonValue>,
    pub path_id: i64,
    pub rolling_stock_id: i64,
    pub timetable_id: i64,
    #[serde(skip_serializing)]
    #[diesel(deserialize_as = String)]
    pub infra_version: Option<String>,
    #[serde(skip_serializing)]
    #[diesel(deserialize_as = i64)]
    pub rollingstock_version: Option<i64>,
}

impl Identifiable for TrainSchedule {
    fn get_id(&self) -> i64 {
        self.id.expect("Train schedule id not found")
    }
}

#[derive(Clone, Debug, Deserialize, Queryable, Insertable, AsChangeset, Model)]
#[model(table = "osrd_infra_trainschedule")]
#[model(update)]
#[diesel(belongs_to(Timetable))]
#[diesel(table_name = osrd_infra_trainschedule)]
pub struct TrainScheduleChangeset {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub train_name: Option<String>,
    #[diesel(deserialize_as = JsonValue)]
    pub labels: Option<JsonValue>,
    #[diesel(deserialize_as = f64)]
    pub departure_time: Option<f64>,
    #[diesel(deserialize_as = f64)]
    pub initial_speed: Option<f64>,
    #[diesel(deserialize_as = DieselJson<Vec<Allowance>>)]
    pub allowances: Option<DieselJson<Vec<Allowance>>>,
    #[diesel(deserialize_as = DieselJson<Vec<ScheduledPoint>>)]
    pub scheduled_points: Option<DieselJson<Vec<ScheduledPoint>>>,
    #[diesel(deserialize_as = String)]
    pub comfort: Option<String>,
    #[diesel(deserialize_as = Option<String>)]
    pub speed_limit_tags: Option<Option<String>>,
    #[diesel(deserialize_as = Option<JsonValue>)]
    pub power_restriction_ranges: Option<Option<JsonValue>>,
    #[diesel(deserialize_as = Option<JsonValue>)]
    pub options: Option<Option<JsonValue>>,
    #[diesel(deserialize_as = i64)]
    pub path_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub rolling_stock_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub timetable_id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub infra_version: Option<String>,
    #[diesel(deserialize_as = i64)]
    pub rollingstock_version: Option<i64>,
}

impl From<TrainScheduleChangeset> for TrainSchedule {
    fn from(changeset: TrainScheduleChangeset) -> Self {
        TrainSchedule {
            id: changeset.id,
            train_name: changeset.train_name.expect("invalid changeset result"),
            labels: changeset.labels.expect("invalid changeset result"),
            departure_time: changeset.departure_time.expect("invalid changeset result"),
            initial_speed: changeset.initial_speed.expect("invalid changeset result"),
            allowances: changeset.allowances.expect("invalid changeset result"),
            scheduled_points: changeset
                .scheduled_points
                .expect("invalid changeset result"),
            comfort: changeset.comfort.expect("invalid changeset result"),
            speed_limit_tags: changeset
                .speed_limit_tags
                .expect("invalid changeset result"),
            power_restriction_ranges: changeset
                .power_restriction_ranges
                .expect("invalid changeset result"),
            options: changeset.options.expect("invalid changeset result"),
            path_id: changeset.path_id.expect("invalid changeset result"),
            rolling_stock_id: changeset
                .rolling_stock_id
                .expect("invalid changeset result"),
            timetable_id: changeset.timetable_id.expect("invalid changeset result"),
            infra_version: changeset.infra_version,
            rollingstock_version: changeset.rollingstock_version,
        }
    }
}
/// Returns the timetable with the main information about a train
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, Queryable)]
pub struct LightTrainSchedule {
    pub id: i64,
    pub train_name: String,
    pub departure_time: f64,
    pub train_path: i64,
}

#[derive(Serialize, Debug, PartialEq, Clone, Default, Deserialize)]
pub struct MechanicalEnergyConsumedBaseEco {
    pub base: f64,
    pub eco: Option<f64>,
}

#[derive(Serialize, Debug, PartialEq, Clone, Deserialize)]
pub enum TrainScheduleValidation {
    NewerRollingStock,
    NewerInfra,
}

/// Returns the timetable with the train's important route information (distance travelled, arrival time, etc.)
#[derive(Serialize, Debug, PartialEq, Clone, Queryable, Deserialize)]
pub struct TrainScheduleSummary {
    #[serde(flatten)]
    pub train_schedule: TrainSchedule,
    pub arrival_time: f64,
    pub mechanical_energy_consumed: MechanicalEnergyConsumedBaseEco,
    pub stops_count: i64,
    pub path_length: f64,
    pub invalid_reasons: Vec<TrainScheduleValidation>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResultSpeed {
    pub time: f64,
    pub position: f64,
    pub speed: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResultPosition {
    pub time: f64,
    pub track_section: String,
    pub offset: f64,
    pub path_offset: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ResultStops {
    pub time: f64,
    pub position: f64,
    pub duration: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct FullResultStops {
    #[serde(flatten)]
    pub result_stops: ResultStops,
    pub id: Option<String>,
    pub name: Option<String>,
    pub line_code: Option<i32>,
    pub track_number: Option<i32>,
    pub line_name: Option<String>,
    pub track_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResultOccupancyTiming {
    pub time_head_occupy: f64,
    pub time_tail_free: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignalSighting {
    pub signal: String,
    pub time: f64,
    pub offset: f64,
    pub state: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ZoneUpdate {
    pub zone: String,
    pub time: f64,
    pub offset: f64,
    // TODO: see https://github.com/DGEXSolutions/osrd/issues/4294
    #[serde(rename = "isEntry")]
    pub is_entry: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpacingRequirement {
    pub zone: String,
    pub begin_time: f64,
    pub end_time: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResultTrain {
    pub speeds: Vec<ResultSpeed>,
    pub head_positions: Vec<ResultPosition>,
    pub stops: Vec<ResultStops>,
    pub route_occupancies: HashMap<String, ResultOccupancyTiming>,
    pub mechanical_energy_consumed: f64,
    pub signal_sightings: Vec<SignalSighting>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub spacing_requirements: Vec<SpacingRequirement>,
}

#[derive(
    Associations,
    Clone,
    Debug,
    Deserialize,
    Derivative,
    Identifiable,
    Model,
    PartialEq,
    Queryable,
    Selectable,
    Serialize,
    QueryableByName,
)]
#[model(table = "osrd_infra_simulationoutput")]
#[model(delete, retrieve)]
#[diesel(belongs_to(TrainSchedule))]
#[diesel(table_name = osrd_infra_simulationoutput)]
pub struct SimulationOutput {
    pub id: i64,
    pub mrsp: JsonValue,
    pub base_simulation: DieselJson<ResultTrain>,
    pub eco_simulation: Option<DieselJson<ResultTrain>>,
    pub electrification_ranges: JsonValue,
    pub power_restriction_ranges: JsonValue,
    pub train_schedule_id: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, Queryable, Insertable, AsChangeset, Model)]
#[model(table = "osrd_infra_simulationoutput")]
#[model(create)]
#[diesel(belongs_to(TrainSchedule))]
#[diesel(table_name = osrd_infra_simulationoutput)]
pub struct SimulationOutputChangeset {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = JsonValue)]
    pub mrsp: Option<JsonValue>,
    #[diesel(deserialize_as = DieselJson<ResultTrain>)]
    pub base_simulation: Option<DieselJson<ResultTrain>>,
    #[diesel(deserialize_as = Option<DieselJson<ResultTrain>>)]
    pub eco_simulation: Option<Option<DieselJson<ResultTrain>>>,
    #[diesel(deserialize_as = JsonValue)]
    pub electrification_ranges: Option<JsonValue>,
    #[diesel(deserialize_as = JsonValue)]
    pub power_restriction_ranges: Option<JsonValue>,
    #[diesel(deserialize_as = Option<i64>)]
    pub train_schedule_id: Option<Option<i64>>,
}

impl From<SimulationOutput> for SimulationOutputChangeset {
    fn from(simulation_output: SimulationOutput) -> Self {
        Self {
            id: Some(simulation_output.id),
            mrsp: Some(simulation_output.mrsp),
            base_simulation: Some(simulation_output.base_simulation),
            eco_simulation: Some(simulation_output.eco_simulation),
            electrification_ranges: Some(simulation_output.electrification_ranges),
            power_restriction_ranges: Some(simulation_output.power_restriction_ranges),
            train_schedule_id: Some(simulation_output.train_schedule_id),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "value_type")]
pub enum AllowanceValue {
    #[serde(rename = "time_per_distance")]
    TimePerDistance { minutes: f64 },
    #[serde(rename = "time")]
    Time { seconds: f64 },
    #[serde(rename = "percentage")]
    Percent { percentage: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AllowanceDistribution {
    #[serde(rename = "MARECO")]
    Mareco,
    #[serde(rename = "LINEAR")]
    Linear,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RangeAllowance {
    begin_position: f64,
    end_position: f64,
    value: AllowanceValue,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]

pub struct EngineeringAllowance {
    distribution: AllowanceDistribution,
    capacity_speed_limit: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StandardAllowance {
    default_value: AllowanceValue,
    ranges: Vec<RangeAllowance>,
    distribution: AllowanceDistribution,
    capacity_speed_limit: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "allowance_type", rename_all = "lowercase")]
pub enum Allowance {
    Engineering(EngineeringAllowance),
    Standard(StandardAllowance),
}

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, PartialEq)]
#[derivative(Default)]
pub struct ScheduledPoint {
    path_offset: f64,
    time: f64,
}
