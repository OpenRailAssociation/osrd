mod effort_curves;
pub use effort_curves::ConditionalEffortCurve;
pub use effort_curves::EffortCurve;
pub use effort_curves::EffortCurveConditions;
pub use effort_curves::EffortCurves;
pub use effort_curves::ModeEffortCurves;

mod rolling_resistance;
pub use rolling_resistance::RollingResistance;
pub use rolling_resistance::RollingResistancePerWeight;

mod energy_source;
pub use energy_source::EnergySource;
pub use energy_source::EnergyStorage;
pub use energy_source::RefillLaw;
pub use energy_source::SpeedDependantPower;

mod etcs_brake_params;
pub use etcs_brake_params::EtcsBrakeParams;

mod supported_signaling_systems;
use serde::Deserializer;
use serde::Serializer;
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

mod rolling_stock_category;
pub use rolling_stock_category::RollingStockCategories;
pub use rolling_stock_category::RollingStockCategory;

use editoast_common::units;
use editoast_common::units::quantities::{
    Acceleration, Deceleration, Length, Mass, Ratio, Time, Velocity,
};
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;

editoast_common::schemas! {
    effort_curves::schemas(),
    energy_source::schemas(),
    etcs_brake_params::schemas(),
    loading_gauge_type::schemas(),
    rolling_stock_metadata::schemas(),
    rolling_resistance::schemas(),
    rolling_stock_livery::schemas(),
    supported_signaling_systems::schemas(),
    rolling_stock_category::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.3";

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(remote = "Self")]
pub struct RollingStock {
    pub name: String,
    pub locked: bool,
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,
    #[serde(with = "units::meter")]
    pub length: Length,
    #[serde(with = "units::meter_per_second")]
    pub max_speed: Velocity,
    #[serde(with = "units::second")]
    pub startup_time: Time,
    #[serde(with = "units::meter_per_second_squared")]
    pub startup_acceleration: Acceleration,
    #[serde(with = "units::meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,
    // The constant gamma braking coefficient used when NOT circulating
    // under ETCS/ERTMS signaling system
    #[serde(with = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,
    pub etcs_brake_params: Option<EtcsBrakeParams>,
    #[serde(with = "units::basis_point")]
    pub inertia_coefficient: Ratio,
    #[serde(with = "units::kilogram")]
    pub mass: Mass,
    pub rolling_resistance: RollingResistance,
    pub loading_gauge: LoadingGaugeType,
    /// Mapping of power restriction code to power class
    #[serde(default)]
    pub power_restrictions: HashMap<String, String>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    /// The time the train takes before actually using electrical power (in seconds).
    /// Is null if the train is not electric.
    #[serde(default, with = "units::second::option")]
    pub electrical_power_startup_time: Option<Time>,
    /// The time it takes to raise this train's pantograph in seconds.
    /// Is null if the train is not electric.
    #[serde(default, with = "units::second::option")]
    pub raise_pantograph_time: Option<Time>,
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
    pub railjson_version: String,
    #[serde(default)]
    pub metadata: Option<RollingStockMetadata>,
}

impl<'de> Deserialize<'de> for RollingStock {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let rolling_stock = RollingStock::deserialize(deserializer)?;

        if rolling_stock
            .supported_signaling_systems
            .0
            .contains(&"ETCS_LEVEL2".to_string())
            && rolling_stock.etcs_brake_params.is_none()
        {
            return Err(serde::de::Error::custom(
                "invalid rolling-stock, supporting ETCS_LEVEL2 signaling system requires providing ETCS brake parameters.",
            ));
        }
        Ok(rolling_stock)
    }
}

impl Serialize for RollingStock {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        RollingStock::serialize(self, serializer)
    }
}
