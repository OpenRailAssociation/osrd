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

mod train_main_category;
pub use train_main_category::TrainMainCategories;
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
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.3";

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
    pub etcs_brake_params: Option<EtcsBrakeParams>,
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
    supported_signaling_systems: RollingStockSupportedSignalingSystems,
    #[schema(default = default_rolling_stock_railjson_version)]
    #[serde(default = "default_rolling_stock_railjson_version")]
    pub railjson_version: String,
    #[serde(default)]
    pub metadata: Option<RollingStockMetadata>,
    pub primary_category: TrainMainCategory,
    pub other_categories: TrainMainCategories,
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
            .0
            .iter()
            .any(|category| category == &rolling_stock.primary_category)
        {
            return Err(serde::de::Error::custom(
                "invalid rolling-stock: primary_category: The primary_category cannot be listed in other_categories for rolling stocks.",
            ));
        }

        if rolling_stock
            .supported_signaling_systems
            .0
            .contains(&"ETCS_LEVEL2".to_string())
        {
            return Err(serde::de::Error::custom(
                "invalid rolling-stock: 'ETCS_LEVEL2' can't be listed in 'supported_signaling_systems', providing 'etcs_brake_params' field is the (only) way to trigger ETCS_LEVEL2 support.",
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

impl RollingStock {
    /// Returns the supported signaling systems, including "ETCS_LEVEL2" if `etcs_brake_params` is set.
    pub fn get_all_supported_signaling_systems(&self) -> RollingStockSupportedSignalingSystems {
        let mut supported_signaling_systems = self.supported_signaling_systems.0.clone();
        if self.etcs_brake_params.is_some() {
            supported_signaling_systems.push("ETCS_LEVEL2".into());
        }
        RollingStockSupportedSignalingSystems(supported_signaling_systems)
    }

    pub fn raw_supported_signaling_systems(&self) -> RollingStockSupportedSignalingSystems {
        self.supported_signaling_systems.clone()
    }

    #[cfg(any(test, feature = "testing"))]
    pub fn set_raw_supported_signaling_systems(
        &mut self,
        supported_signaling_systems: RollingStockSupportedSignalingSystems,
    ) {
        self.supported_signaling_systems = supported_signaling_systems;
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new(
        name: String,
        effort_curves: EffortCurves,
        base_power_class: Option<String>,
        length: Length,
        max_speed: Velocity,
        startup_time: Time,
        startup_acceleration: Acceleration,
        comfort_acceleration: Acceleration,
        const_gamma: Deceleration,
        etcs_brake_params: Option<EtcsBrakeParams>,
        inertia_coefficient: f64,
        mass: Mass,
        rolling_resistance: RollingResistance,
        loading_gauge: LoadingGaugeType,
        power_restrictions: HashMap<String, String>,
        energy_sources: Vec<EnergySource>,
        electrical_power_startup_time: Option<Time>,
        raise_pantograph_time: Option<Time>,
        supported_signaling_systems: RollingStockSupportedSignalingSystems,
        railjson_version: String,
        metadata: Option<RollingStockMetadata>,
        primary_category: TrainMainCategory,
        other_categories: TrainMainCategories,
    ) -> Self {
        Self {
            name,
            effort_curves,
            base_power_class,
            length,
            max_speed,
            startup_time,
            startup_acceleration,
            comfort_acceleration,
            const_gamma,
            etcs_brake_params,
            inertia_coefficient,
            mass,
            rolling_resistance,
            loading_gauge,
            power_restrictions,
            energy_sources,
            electrical_power_startup_time,
            raise_pantograph_time,
            supported_signaling_systems,
            railjson_version,
            metadata,
            primary_category,
            other_categories,
        }
    }
}
