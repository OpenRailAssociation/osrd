use std::collections::HashMap;

use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::EffortCurves;
use super::EnergySource;
use super::Gamma;
use super::LoadingGaugeType;
use super::RollingResistance;
use super::RollingStockSupportedSignalingSystems;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Derivative)]
#[derivative(PartialEq)]
pub struct RollingStockCommon {
    pub name: String,
    pub effort_curves: EffortCurves,
    #[schema(example = "5", required)]
    pub base_power_class: Option<String>,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: Gamma,
    pub inertia_coefficient: f64,
    pub mass: f64,
    pub rolling_resistance: RollingResistance,
    pub loading_gauge: LoadingGaugeType,
    /// Mapping of power restriction code to power class
    #[serde(default)]
    #[schema(required)]
    pub power_restrictions: HashMap<String, String>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    /// The time the train takes before actually using electrical power (in seconds). Is null if the train is not electric.
    #[schema(example = 5.0)]
    pub electrical_power_startup_time: Option<f64>,
    /// The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric.
    #[schema(example = 15.0)]
    pub raise_pantograph_time: Option<f64>,
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}
