pub mod light_rolling_stock;
pub mod rolling_stock_livery;

use std::collections::HashMap;

use derivative::Derivative;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;

editoast_common::schemas! {
    RollingStockCommon,
    RollingStockLivery,
    RollingStockLiveryMetadata,
    RollingStockWithLiveries,
    editoast_schemas::rolling_stock::schemas(),
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
