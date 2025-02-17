use std::collections::HashMap;

use editoast_common::units::{quantities::*, *};
use editoast_models::rolling_stock::RollingStockCategories;
use editoast_models::rolling_stock::RollingStockCategory;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::EtcsBrakeParams;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use editoast_schemas::rolling_stock::ROLLING_STOCK_RAILJSON_VERSION;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::models::Changeset;
use crate::models::Model;
use crate::models::RollingStockModel;

#[editoast_derive::annotate_units]
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct RollingStockForm {
    pub name: String,
    pub effort_curves: EffortCurves,
    #[schema(example = "5", required)]
    pub base_power_class: Option<String>,
    #[serde(with = "meter")]
    pub length: Length,
    #[serde(with = "meter_per_second")]
    pub max_speed: Velocity,
    #[serde(with = "second")]
    pub startup_time: Time,
    #[serde(with = "meter_per_second_squared")]
    pub startup_acceleration: Acceleration,
    #[serde(with = "meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,
    #[serde(with = "meter_per_second_squared")]
    pub const_gamma: Deceleration,
    #[serde(with = "basis_point")]
    pub inertia_coefficient: Ratio,
    #[serde(with = "kilogram")]
    pub mass: Mass,
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
    #[serde(default, with = "second::option")]
    pub electrical_power_startup_time: Option<Time>,
    pub etcs_brake_params: Option<EtcsBrakeParams>,
    /// The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric.
    #[schema(example = 15.0)]
    #[serde(default, with = "second::option")]
    pub raise_pantograph_time: Option<Time>,
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
    pub locked: Option<bool>,
    pub metadata: Option<RollingStockMetadata>,
    pub primary_category: RollingStockCategory,
    pub other_categories: RollingStockCategories,
}

impl From<RollingStockForm> for Changeset<RollingStockModel> {
    fn from(rolling_stock: RollingStockForm) -> Self {
        RollingStockModel::changeset()
            .railjson_version(ROLLING_STOCK_RAILJSON_VERSION.to_string())
            .flat_locked(rolling_stock.locked)
            .metadata(rolling_stock.metadata)
            .name(rolling_stock.name)
            .effort_curves(rolling_stock.effort_curves)
            .base_power_class(rolling_stock.base_power_class)
            .length(rolling_stock.length)
            .max_speed(rolling_stock.max_speed)
            .startup_time(rolling_stock.startup_time)
            .startup_acceleration(rolling_stock.startup_acceleration)
            .comfort_acceleration(rolling_stock.comfort_acceleration)
            .const_gamma(rolling_stock.const_gamma)
            .etcs_brake_params(rolling_stock.etcs_brake_params)
            .inertia_coefficient(rolling_stock.inertia_coefficient)
            .mass(rolling_stock.mass)
            .rolling_resistance(rolling_stock.rolling_resistance)
            .loading_gauge(rolling_stock.loading_gauge)
            .power_restrictions(rolling_stock.power_restrictions)
            .energy_sources(rolling_stock.energy_sources)
            .electrical_power_startup_time(rolling_stock.electrical_power_startup_time)
            .raise_pantograph_time(rolling_stock.raise_pantograph_time)
            .supported_signaling_systems(rolling_stock.supported_signaling_systems)
            .primary_category(rolling_stock.primary_category)
            .other_categories(rolling_stock.other_categories)
    }
}

// Used in some tests where we import a rolling stock as a fixture
#[cfg(test)]
impl From<RollingStockModel> for RollingStockForm {
    fn from(value: RollingStockModel) -> Self {
        RollingStockForm {
            name: value.name,
            effort_curves: value.effort_curves,
            base_power_class: value.base_power_class,
            length: value.length,
            max_speed: value.max_speed,
            startup_time: value.startup_time,
            startup_acceleration: value.startup_acceleration,
            comfort_acceleration: value.comfort_acceleration,
            const_gamma: value.const_gamma,
            etcs_brake_params: value.etcs_brake_params,
            inertia_coefficient: value.inertia_coefficient,
            mass: value.mass,
            rolling_resistance: value.rolling_resistance,
            loading_gauge: value.loading_gauge,
            power_restrictions: value.power_restrictions,
            energy_sources: value.energy_sources,
            electrical_power_startup_time: value.electrical_power_startup_time,
            raise_pantograph_time: value.raise_pantograph_time,
            supported_signaling_systems: value.supported_signaling_systems,
            locked: Some(value.locked),
            metadata: value.metadata,
            primary_category: value.primary_category,
            other_categories: value.other_categories,
        }
    }
}
