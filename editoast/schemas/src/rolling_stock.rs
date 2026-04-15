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

mod supported_signaling_system;
pub use supported_signaling_system::SupportedSignalingSystem;

mod rolling_stock_metadata;
pub use rolling_stock_metadata::RollingStockMetadata;

mod loading_gauge_type;
pub use loading_gauge_type::LoadingGaugeType;

mod rolling_stock_livery;
pub use rolling_stock_livery::RollingStockLivery;
pub use rolling_stock_livery::RollingStockLiveryMetadata;

mod towed_rolling_stock;
pub use towed_rolling_stock::TowedRollingStock;

mod train_main_category;
pub use train_main_category::TrainMainCategory;

mod sub_category;
pub use sub_category::SubCategory;
pub use sub_category::SubCategoryColor;

mod train_category;
pub use train_category::TrainCategory;

use common::units;
use common::units::quantities::Acceleration;
use common::units::quantities::Deceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Time;
use common::units::quantities::Velocity;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::Serializer;
use std::collections::HashMap;
use std::collections::HashSet;
use utoipa::ToSchema;

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.4";

pub fn default_rolling_stock_railjson_version() -> String {
    ROLLING_STOCK_RAILJSON_VERSION.to_string()
}

#[editoast_derive::annotate_units]
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(remote = "Self")]
#[schema(as = RollingStockForm)]
pub struct RollingStock {
    pub name: String,
    pub effort_curves: EffortCurves,
    #[schema(example = "5", required)]
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
    /// The constant gamma braking coefficient used when NOT circulating
    /// under ETCS/ERTMS signaling system
    #[serde(with = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,
    pub inertia_coefficient: f64,
    #[serde(with = "units::kilogram")]
    pub mass: Mass,
    pub rolling_resistance: RollingResistance,
    pub loading_gauge: LoadingGaugeType,
    /// Mapping of power restriction code to power class
    #[schema(required)]
    #[serde(default)]
    pub power_restrictions: HashMap<String, String>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    /// The time the train takes before actually using electrical power (in seconds).
    /// Is null if the train is not electric.
    #[schema(example = 5.0)]
    #[serde(default, with = "units::second::option")]
    pub electrical_power_startup_time: Option<Time>,
    /// The time it takes to raise this train's pantograph in seconds.
    /// Is null if the train is not electric.
    #[schema(example = 15.0)]
    #[serde(default, with = "units::second::option")]
    pub raise_pantograph_time: Option<Time>,
    pub supported_signaling_systems: HashSet<SupportedSignalingSystem>,
    #[schema(default = default_rolling_stock_railjson_version)]
    #[serde(default = "default_rolling_stock_railjson_version")]
    pub railjson_version: String,
    #[serde(default)]
    pub metadata: Option<RollingStockMetadata>,
    pub primary_category: TrainMainCategory,
    pub other_categories: Vec<TrainMainCategory>,
}

impl RollingStock {
    pub fn supported_signaling_systems(&self) -> HashSet<String> {
        self.supported_signaling_systems
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    pub fn get_etcs_brake_params(&self) -> Option<&EtcsBrakeParams> {
        use SupportedSignalingSystem::*;
        self.supported_signaling_systems
            .iter()
            .find_map(|s| match s {
                EtcsLevel2 { brake_params } => Some(brake_params),
                BAL | BAPR | TVM300 | TVM430 => None,
            })
    }
}

impl<'de> Deserialize<'de> for RollingStock {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let rolling_stock = RollingStock::deserialize(deserializer)?;

        if rolling_stock.effort_curves.is_electric() {
            if rolling_stock.electrical_power_startup_time.is_none() {
                return Err(serde::de::Error::custom(
                    "invalid rolling-stock: effort_curves: electrical_power_startup_time is required for electric rolling stocks.",
                ));
            }
            if rolling_stock.raise_pantograph_time.is_none() {
                return Err(serde::de::Error::custom(
                    "invalid rolling-stock: effort_curves: raise_pantograph_time is required for electric rolling stocks.",
                ));
            }
        }

        if rolling_stock
            .other_categories
            .iter()
            .any(|category| category == &rolling_stock.primary_category)
        {
            return Err(serde::de::Error::custom(
                "invalid rolling-stock: primary_category: The primary_category cannot be listed in other_categories for rolling stocks.",
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
