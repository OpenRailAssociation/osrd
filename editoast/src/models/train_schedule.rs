use std::collections::HashMap;

use crate::error::Result;
use crate::tables::train_schedule;
use crate::{
    models::{Identifiable, Timetable},
    tables::simulation_output,
};
use crate::{DbPool, DieselJson};
use actix_web::web::Data;
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::RunQueryDsl;
use serde_json::Value as JsonValue;

use editoast_derive::Model;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::{
    check_train_validity, get_timetable_train_schedules, LightRollingStockModel, Retrieve,
};

crate::schemas! {
    TrainSchedule,
    PowerRestrictionRange,
    LightTrainSchedule,
    MechanicalEnergyConsumedBaseEco,
    TrainScheduleValidation,
    TrainScheduleSummary,
    TrainScheduleOptions,
    AllowanceValue,
    AllowanceDistribution,
    RangeAllowance,
    EngineeringAllowance,
    StandardAllowance,
    Allowance,
    ScheduledPoint,
}

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
    ToSchema,
    Serialize,
)]
#[model(table = "train_schedule")]
#[model(create, delete, retrieve)]
#[diesel(belongs_to(Timetable))]
#[diesel(table_name = train_schedule)]
#[derivative(Default)]
pub struct TrainSchedule {
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub id: Option<i64>,
    pub train_name: String,
    #[schema(value_type = Vec<String>)]
    pub labels: DieselJson<Vec<String>>,
    pub departure_time: f64,
    pub initial_speed: f64,
    #[derivative(Default)]
    #[schema(value_type = Vec<Allowance>)]
    pub allowances: DieselJson<Vec<Allowance>>,
    #[derivative(Default(
        value = "crate::schema::rolling_stock::RollingStockComfortType::default().to_string()"
    ))]
    #[schema(value_type = RollingStockComfortType)]
    pub comfort: String,
    #[schema(required)]
    pub speed_limit_tags: Option<String>,
    #[schema(required, value_type = Option<Vec<PowerRestrictionRange>>)]
    pub power_restriction_ranges: Option<DieselJson<Vec<PowerRestrictionRange>>>,
    #[schema(required, value_type = Option<TrainScheduleOptions>)]
    pub options: Option<DieselJson<TrainScheduleOptions>>,
    pub path_id: i64,
    pub rolling_stock_id: i64,
    pub timetable_id: i64,
    #[derivative(Default(value = "DieselJson(Default::default())"))]
    #[schema(value_type = Vec<ScheduledPoint>)]
    pub scheduled_points: DieselJson<Vec<ScheduledPoint>>,
    #[serde(skip_serializing)]
    #[diesel(deserialize_as = String)]
    #[schema(required)]
    pub infra_version: Option<String>,
    #[serde(skip_serializing)]
    #[diesel(deserialize_as = i64)]
    #[schema(required)]
    pub rollingstock_version: Option<i64>,
}

impl Identifiable for TrainSchedule {
    fn get_id(&self) -> i64 {
        self.id.expect("Train schedule id not found")
    }
}

#[derive(Clone, Default, Debug, Deserialize, Queryable, Insertable, AsChangeset, Model)]
#[model(table = "train_schedule")]
#[model(update)]
#[diesel(belongs_to(Timetable))]
#[diesel(table_name = train_schedule)]
pub struct TrainScheduleChangeset {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub train_name: Option<String>,
    #[diesel(deserialize_as = DieselJson<Vec<String>>)]
    pub labels: Option<DieselJson<Vec<String>>>,
    #[diesel(deserialize_as = f64)]
    pub departure_time: Option<f64>,
    #[diesel(deserialize_as = f64)]
    pub initial_speed: Option<f64>,
    #[diesel(deserialize_as = DieselJson<Vec<Allowance>>)]
    pub allowances: Option<DieselJson<Vec<Allowance>>>,
    #[diesel(deserialize_as = String)]
    pub comfort: Option<String>,
    #[diesel(deserialize_as = Option<String>)]
    pub speed_limit_tags: Option<Option<String>>,
    #[diesel(deserialize_as = Option<DieselJson<Vec<PowerRestrictionRange>>>)]
    pub power_restriction_ranges: Option<Option<DieselJson<Vec<PowerRestrictionRange>>>>,
    #[diesel(deserialize_as = Option<DieselJson<TrainScheduleOptions>>)]
    pub options: Option<Option<DieselJson<TrainScheduleOptions>>>,
    #[diesel(deserialize_as = i64)]
    pub path_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub rolling_stock_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub timetable_id: Option<i64>,
    #[diesel(deserialize_as = DieselJson<Vec<ScheduledPoint>>)]
    pub scheduled_points: Option<DieselJson<Vec<ScheduledPoint>>>,
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
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, Queryable, ToSchema)]
pub struct LightTrainSchedule {
    pub id: i64,
    pub train_name: String,
    pub departure_time: f64,
    pub train_path: i64,
}

#[derive(Serialize, Debug, PartialEq, Clone, Default, Deserialize, ToSchema)]
pub struct MechanicalEnergyConsumedBaseEco {
    pub base: f64,
    pub eco: Option<f64>,
}

#[derive(Serialize, Debug, PartialEq, Clone, Deserialize, ToSchema)]
pub enum TrainScheduleValidation {
    NewerRollingStock,
    NewerInfra,
}

/// Returns the timetable with the train's important route information (distance travelled, arrival time, etc.)
#[derive(Serialize, Debug, PartialEq, Clone, Queryable, Deserialize, ToSchema)]
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
pub struct RoutingZoneRequirement {
    pub zone: String,
    pub entry_detector: String,
    pub exit_detector: String,
    pub switches: HashMap<String, String>,
    pub end_time: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingRequirement {
    pub route: String,
    pub begin_time: f64,
    pub zones: Vec<RoutingZoneRequirement>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Derivative)]
#[derivative(Default)]
pub struct ResultTrain {
    pub speeds: Vec<ResultSpeed>,
    pub head_positions: Vec<ResultPosition>,
    pub stops: Vec<ResultStops>,
    pub mechanical_energy_consumed: f64,
    pub signal_sightings: Vec<SignalSighting>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

/// A range along the train path where a power restriction is applied.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
#[schema(example = json!({
    "begin_position": 0.0,
    "end_position": 1000.0,
    "power_restriction_code": "C1US"
}))]
pub struct PowerRestrictionRange {
    /// Offset from the start of the path, in meters.
    begin_position: f32,
    /// Offset from the start of the path, in meters.
    end_position: f32,
    /// The power restriction code to apply.
    power_restriction_code: String,
}

/// Options for the standalone simulation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TrainScheduleOptions {
    /// Whether to ignore the electrical profile of the train for simulation
    ignore_electrical_profiles: Option<bool>,
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
#[derivative(Default)]
#[model(table = "simulation_output")]
#[model(delete, retrieve)]
#[diesel(belongs_to(TrainSchedule))]
#[diesel(table_name = simulation_output)]
pub struct SimulationOutput {
    pub id: i64,
    pub mrsp: JsonValue,
    pub base_simulation: DieselJson<ResultTrain>,
    pub eco_simulation: Option<DieselJson<ResultTrain>>,
    pub electrification_ranges: JsonValue,
    pub train_schedule_id: Option<i64>,
    pub power_restriction_ranges: JsonValue,
}

impl Identifiable for SimulationOutput {
    fn get_id(&self) -> i64 {
        self.id
    }
}

#[derive(
    Clone, Debug, Deserialize, Queryable, Derivative, Insertable, Identifiable, AsChangeset, Model,
)]
#[model(table = "simulation_output")]
#[model(create, delete)]
#[diesel(belongs_to(TrainSchedule))]
#[diesel(table_name = simulation_output)]
#[derivative(Default(new = "true"))]
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
    #[diesel(deserialize_as = Option<i64>)]
    pub train_schedule_id: Option<Option<i64>>,
    #[diesel(deserialize_as = JsonValue)]
    pub power_restriction_ranges: Option<JsonValue>,
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

impl From<SimulationOutputChangeset> for SimulationOutput {
    fn from(value: SimulationOutputChangeset) -> Self {
        Self {
            id: value.id.expect("invalid changeset result"),
            mrsp: value.mrsp.expect("invalid changeset result"),
            base_simulation: value.base_simulation.expect("invalid changeset result"),
            eco_simulation: value.eco_simulation.expect("invalid changeset result"),
            electrification_ranges: value
                .electrification_ranges
                .expect("invalid changeset result"),
            power_restriction_ranges: value
                .power_restriction_ranges
                .expect("invalid changeset result"),
            train_schedule_id: value.train_schedule_id.expect("invalid changeset result"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(tag = "value_type")]
pub enum AllowanceValue {
    #[serde(rename = "time_per_distance")]
    TimePerDistance { minutes: f64 },
    #[serde(rename = "time")]
    Time { seconds: f64 },
    #[serde(rename = "percentage")]
    Percent { percentage: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum AllowanceDistribution {
    Mareco,
    Linear,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct RangeAllowance {
    begin_position: f64,
    end_position: f64,
    value: AllowanceValue,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]

pub struct EngineeringAllowance {
    #[serde(flatten)]
    range: RangeAllowance,
    distribution: AllowanceDistribution,
    #[serde(default = "default_capacity_speed_limit")]
    #[schema(default = default_capacity_speed_limit)]
    capacity_speed_limit: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct StandardAllowance {
    default_value: AllowanceValue,
    ranges: Vec<RangeAllowance>,
    distribution: AllowanceDistribution,
    #[serde(default = "default_capacity_speed_limit")]
    capacity_speed_limit: f64,
}

fn default_capacity_speed_limit() -> f64 {
    -1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(tag = "allowance_type", rename_all = "lowercase")]
pub enum Allowance {
    Engineering(EngineeringAllowance),
    Standard(StandardAllowance),
}

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, PartialEq, ToSchema)]
#[derivative(Default)]
pub struct ScheduledPoint {
    pub path_offset: f64,
    pub time: f64,
}

pub async fn filter_invalid_trains(
    db_pool: Data<DbPool>,
    timetable_id: i64,
    infra_version: String,
) -> Result<Vec<TrainSchedule>> {
    let schedules = get_timetable_train_schedules(timetable_id, db_pool.clone()).await?;
    let mut result = Vec::new();
    for schedule in schedules.into_iter() {
        let mut conn = db_pool.get().await?;
        let rolling_stock =
            LightRollingStockModel::retrieve_conn(&mut conn, schedule.rolling_stock_id)
                .await
                .unwrap();
        let current_rolling_stock_version = rolling_stock.unwrap().version;
        let valid = check_train_validity(
            &infra_version,
            schedule.rollingstock_version.unwrap(),
            &schedule.infra_version.clone().unwrap(),
            current_rolling_stock_version,
        )
        .is_empty();
        if valid {
            result.push(schedule)
        }
    }
    Ok(result)
}
