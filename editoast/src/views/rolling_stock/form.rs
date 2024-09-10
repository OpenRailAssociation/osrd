use std::collections::HashMap;

use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use editoast_schemas::rolling_stock::ROLLING_STOCK_RAILJSON_VERSION;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;
use validator::Validate;
use validator::ValidationError;

use crate::models::rolling_stock_model::validate_rolling_stock;
use crate::models::Changeset;
use crate::models::Model;
use crate::models::RollingStockModel;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema, Validate)]
#[validate(schema(function = "validate_rolling_stock_form"))]
pub struct RollingStockForm {
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
    pub locked: Option<bool>,
    pub metadata: Option<RollingStockMetadata>,
    pub freight_compatible: Option<bool>,
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
            .gamma(rolling_stock.gamma)
            .inertia_coefficient(rolling_stock.inertia_coefficient)
            .mass(rolling_stock.mass)
            .rolling_resistance(rolling_stock.rolling_resistance)
            .loading_gauge(rolling_stock.loading_gauge)
            .power_restrictions(rolling_stock.power_restrictions)
            .energy_sources(rolling_stock.energy_sources)
            .electrical_power_startup_time(rolling_stock.electrical_power_startup_time)
            .raise_pantograph_time(rolling_stock.raise_pantograph_time)
            .supported_signaling_systems(rolling_stock.supported_signaling_systems)
            .freight_compatible(rolling_stock.freight_compatible)
    }
}

fn validate_rolling_stock_form(
    rolling_stock_form: &RollingStockForm,
) -> std::result::Result<(), ValidationError> {
    validate_rolling_stock(
        &rolling_stock_form.effort_curves,
        rolling_stock_form.electrical_power_startup_time,
        rolling_stock_form.raise_pantograph_time,
    )
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
            gamma: value.gamma,
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
            freight_compatible: value.freight_compatible,
        }
    }
}
