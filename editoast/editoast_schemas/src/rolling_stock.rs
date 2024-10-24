mod gamma;
pub use gamma::Gamma;

mod effort_curves;
pub use effort_curves::ConditionalEffortCurve;
pub use effort_curves::EffortCurve;
pub use effort_curves::EffortCurveConditions;
pub use effort_curves::EffortCurves;
pub use effort_curves::ModeEffortCurves;

mod rolling_resistance;
pub use rolling_resistance::RollingResistance;

mod energy_source;
pub use energy_source::EnergySource;
pub use energy_source::EnergyStorage;
pub use energy_source::RefillLaw;
pub use energy_source::SpeedDependantPower;

mod supported_signaling_systems;
pub use supported_signaling_systems::RollingStockSupportedSignalingSystems;

mod rolling_stock_metadata;
pub use rolling_stock_metadata::RollingStockMetadata;

mod loading_gauge_type;
pub use loading_gauge_type::LoadingGaugeType;

mod rolling_stock_livery;
pub use rolling_stock_livery::RollingStockLivery;
pub use rolling_stock_livery::RollingStockLiveryMetadata;

mod towed_rolling_stock;
pub use towed_rolling_stock::TowedRollingStock;

use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;

editoast_common::schemas! {
    effort_curves::schemas(),
    energy_source::schemas(),
    gamma::schemas(),
    loading_gauge_type::schemas(),
    rolling_stock_metadata::schemas(),
    rolling_resistance::schemas(),
    rolling_stock_livery::schemas(),
    supported_signaling_systems::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.2";

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct RollingStock {
    pub name: String,
    pub locked: bool,
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,
    /// In m
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
    pub power_restrictions: HashMap<String, String>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    /// The time the train takes before actually using electrical power (in seconds). Is null if the train is not electric.
    pub electrical_power_startup_time: Option<f64>,
    /// The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric.
    #[serde(default)]
    pub raise_pantograph_time: Option<f64>,
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
    pub railjson_version: String,
    #[serde(default)]
    pub metadata: Option<RollingStockMetadata>,
}
