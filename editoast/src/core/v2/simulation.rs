use std::collections::BTreeMap;

use chrono::DateTime;
use chrono::Utc;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde::Serialize;

use crate::core::{AsCoreRequest, Json};
use crate::schema::v2::trainschedule::{Comfort, Distribution};
use crate::views::v2::path::TrackRange;
use crate::views::v2::train_schedule::CompleteReportTrain;
use crate::views::v2::train_schedule::Mrsp;
use crate::views::v2::train_schedule::ReportTrain;
use crate::RollingStockModel;
use derivative::Derivative;
use editoast_common::Identifier;
use std::hash::Hash;

#[derive(Debug, Serialize, Derivative)]
#[derivative(Hash)]
pub struct PhysicRollingStock {
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,
    /// Length of the rolling stock in mm
    pub length: u64,
    /// Maximum speed of the rolling stock in m/s
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))]
    pub max_speed: f64,
    // Time in ms
    pub startup_time: u64,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub startup_acceleration: f64,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub comfort_acceleration: f64,
    pub gamma: Gamma,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub inertia_coefficient: f64,
    /// Mass of the rolling stock in kg
    pub mass: u64,
    pub rolling_resistance: RollingResistance,
    /// Mapping of power restriction code to power class
    #[serde(default)]
    pub power_restrictions: BTreeMap<String, String>,
    /// The time the train takes before actually using electrical power (in miliseconds).
    /// Is null if the train is not electric or the value not specified.
    pub electrical_power_startup_time: Option<u64>,
    /// The time it takes to raise this train's pantograph in miliseconds.
    /// Is null if the train is not electric or the value not specified.
    pub raise_pantograph_time: Option<u64>,
}

impl From<RollingStockModel> for PhysicRollingStock {
    fn from(value: RollingStockModel) -> Self {
        Self {
            effort_curves: value.effort_curves,
            base_power_class: value.base_power_class,
            length: (value.length * 1000.0).round() as u64,
            max_speed: value.max_speed,
            startup_time: (value.startup_time * 1000.0).round() as u64,
            startup_acceleration: value.startup_acceleration,
            comfort_acceleration: value.comfort_acceleration,
            gamma: value.gamma,
            inertia_coefficient: value.inertia_coefficient,
            mass: value.mass.round() as u64,
            rolling_resistance: value.rolling_resistance,
            power_restrictions: value.power_restrictions.into_iter().collect(),
            electrical_power_startup_time: value
                .electrical_power_startup_time
                .map(|v| (v * 1000.0).round() as u64),
            raise_pantograph_time: value
                .raise_pantograph_time
                .map(|v| (v * 1000.0).round() as u64),
        }
    }
}

#[derive(Debug, Serialize, Hash)]
pub struct SimulationScheduleItem {
    /// Position on the path in mm
    pub path_offset: u64,
    /// Time in s since the departure of the train
    pub arrival: Option<u64>,
    /// Duration of the stop in s
    pub stop_for: Option<u64>,
}

#[derive(Debug, Serialize, Hash)]
pub struct SimulationMargins {
    /// Path offset separating margin transitions in mm
    pub boundaries: Vec<u64>,
    pub values: Vec<MarginValue>,
}

#[derive(Debug, Serialize, Hash)]
pub struct SimulationPowerRestrictionItem {
    /// Position on the path in mm
    pub from: u64,
    /// Position on the path in mm
    pub to: u64,
    pub value: String,
}

/// Path description
#[derive(Debug, Serialize, Hash)]
pub struct SimulationPath {
    pub blocks: Vec<Identifier>,
    pub routes: Vec<Identifier>,
    pub track_section_ranges: Vec<TrackRange>,
}

#[derive(Debug, Serialize, Derivative)]
#[derivative(Hash)]
pub struct SimulationRequest {
    pub path: SimulationPath,
    pub start_time: DateTime<Utc>,
    pub schedule: Vec<SimulationScheduleItem>,
    pub margins: SimulationMargins,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))]
    pub initial_speed: f64,
    pub comfort: Comfort,
    pub constraint_distribution: Distribution,
    pub speed_limit_tag: Option<String>,
    pub power_restrictions: Vec<SimulationPowerRestrictionItem>,
    pub options: TrainScheduleOptions,
    pub rolling_stock: PhysicRollingStock,
    pub electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SimulationResponse {
    base: ReportTrain,
    provisional: ReportTrain,
    final_output: CompleteReportTrain,
    mrsp: Mrsp,
    power_restriction: String,
}

impl AsCoreRequest<Json<SimulationResponse>> for SimulationRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/simulation";
}
