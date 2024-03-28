use derivative::Derivative;
use serde_derive::Deserialize;
use serde_derive::Serialize;
use utoipa::ToSchema;
use validator::Validate;
use validator::ValidationError;

use crate::modelsv2::rolling_stock_model::validate_rolling_stock;
use crate::modelsv2::Changeset;
use crate::modelsv2::Model;
use crate::modelsv2::RollingStockModel;
use crate::schema::rolling_stock::RollingStockCommon;
use crate::schema::rolling_stock::RollingStockMetadata;
use crate::schema::rolling_stock::ROLLING_STOCK_RAILJSON_VERSION;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema, Validate, Derivative)]
#[derivative(PartialEq)]
#[validate(schema(function = "validate_rolling_stock_form"))]
pub struct RollingStockForm {
    #[serde(flatten)]
    pub common: RollingStockCommon,
    #[derivative(PartialEq = "ignore")]
    pub locked: Option<bool>,
    #[derivative(PartialEq = "ignore")]
    pub metadata: RollingStockMetadata,
}

impl From<RollingStockModel> for RollingStockForm {
    fn from(value: RollingStockModel) -> Self {
        RollingStockForm {
            common: RollingStockCommon {
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
            },
            locked: Some(value.locked),
            metadata: value.metadata,
        }
    }
}

impl From<RollingStockForm> for Changeset<RollingStockModel> {
    fn from(rolling_stock: RollingStockForm) -> Self {
        RollingStockModel::changeset()
            .railjson_version(ROLLING_STOCK_RAILJSON_VERSION.to_string())
            .flat_locked(rolling_stock.locked)
            .metadata(rolling_stock.metadata)
            .name(rolling_stock.common.name)
            .effort_curves(rolling_stock.common.effort_curves)
            .base_power_class(rolling_stock.common.base_power_class)
            .length(rolling_stock.common.length)
            .max_speed(rolling_stock.common.max_speed)
            .startup_time(rolling_stock.common.startup_time)
            .startup_acceleration(rolling_stock.common.startup_acceleration)
            .comfort_acceleration(rolling_stock.common.comfort_acceleration)
            .gamma(rolling_stock.common.gamma)
            .inertia_coefficient(rolling_stock.common.inertia_coefficient)
            .mass(rolling_stock.common.mass)
            .rolling_resistance(rolling_stock.common.rolling_resistance)
            .loading_gauge(rolling_stock.common.loading_gauge)
            .power_restrictions(rolling_stock.common.power_restrictions)
            .energy_sources(rolling_stock.common.energy_sources)
            .electrical_power_startup_time(rolling_stock.common.electrical_power_startup_time)
            .raise_pantograph_time(rolling_stock.common.raise_pantograph_time)
            .supported_signaling_systems(rolling_stock.common.supported_signaling_systems)
    }
}

fn validate_rolling_stock_form(
    rolling_stock_form: &RollingStockForm,
) -> std::result::Result<(), ValidationError> {
    validate_rolling_stock(
        &rolling_stock_form.common.effort_curves,
        rolling_stock_form.common.electrical_power_startup_time,
        rolling_stock_form.common.raise_pantograph_time,
    )
}
