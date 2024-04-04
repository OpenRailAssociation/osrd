pub mod light_rolling_stock;
pub mod rolling_stock_livery;

use std::collections::HashMap;

use derivative::Derivative;
use editoast_schemas::rolling_stock::ConditionalEffortCurve;
use editoast_schemas::rolling_stock::EffortCurve;
use editoast_schemas::rolling_stock::EffortCurveConditions;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::ModeEffortCurves;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockComfortType;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::modelsv2::rolling_stock_model::RollingStockSupportedSignalingSystems;
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::schema::track_section::LoadingGaugeType;

crate::schemas! {
    RollingStockComfortType,
    RollingStockCommon,
    RollingStockLivery,
    RollingStockLiveryMetadata,
    RollingStockWithLiveries,
    RollingResistance,
    RollingStockMetadata,
    Gamma,
    EffortCurve,
    EffortCurves,
    EffortCurveConditions,
    ConditionalEffortCurve,
    ModeEffortCurves,
    EnergySource,
    SpeedDependantPower,
    EnergyStorage,
    RefillLaw,
    light_rolling_stock::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.2";

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

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RollingStock {
    pub id: i64,
    #[serde(flatten)]
    pub common: RollingStockCommon,
    pub railjson_version: String,
    /// Whether the rolling stock can be edited/deleted or not.
    pub locked: bool,
    pub metadata: RollingStockMetadata,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: RollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct RollingStockMetadata {
    detail: String,
    family: String,
    #[serde(rename = "type")]
    rolling_stock_type: String,
    grouping: String,
    series: String,
    subseries: String,
    unit: String,
    number: String,
    reference: String,
}

// Energy sources schema

/// physical law defining how the storage can be refilled
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct RefillLaw {
    #[schema(minimum = 0)]
    tau: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_ref: f64,
}

/// energy storage of an energy source (of a rolling stock, can be a electrical battery or a hydrogen/fuel powerPack)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EnergyStorage {
    capacity: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_min: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_max: f64,
    #[schema(required)]
    refill_law: Option<RefillLaw>,
}

/// power-speed curve (in an energy source)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SpeedDependantPower {
    speeds: Vec<f64>,
    powers: Vec<f64>,
}

/// energy source of a rolling stock
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(tag = "energy_source_type", deny_unknown_fields)]
pub enum EnergySource {
    /// energy source for a rolling stock representing a electrification
    Electrification {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
    PowerPack {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
    /// energy source for a rolling stock representing a battery
    Battery {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
}
