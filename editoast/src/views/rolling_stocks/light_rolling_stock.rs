use std::collections::HashMap;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;

use crate::modelsv2::light_rolling_stock::LightRollingStockModel;

editoast_common::schemas! {
    LightRollingStock,
    LightModeEffortCurves,
    LightEffortCurves,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct LightRollingStock {
    pub id: i64,
    pub name: String,
    pub railjson_version: String,
    pub locked: bool,
    pub effort_curves: LightEffortCurves,
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
    pub metadata: Option<RollingStockMetadata>,
    #[schema(required)]
    pub power_restrictions: HashMap<String, String>,
    pub energy_sources: Vec<EnergySource>,
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

impl From<LightRollingStockModel> for LightRollingStock {
    fn from(rolling_stock_model: LightRollingStockModel) -> Self {
        LightRollingStock {
            id: rolling_stock_model.id,
            name: rolling_stock_model.name,
            railjson_version: rolling_stock_model.railjson_version,
            locked: rolling_stock_model.locked,
            effort_curves: rolling_stock_model.effort_curves,
            base_power_class: rolling_stock_model.base_power_class,
            length: rolling_stock_model.length,
            max_speed: rolling_stock_model.max_speed,
            startup_time: rolling_stock_model.startup_time,
            startup_acceleration: rolling_stock_model.startup_acceleration,
            comfort_acceleration: rolling_stock_model.comfort_acceleration,
            gamma: rolling_stock_model.gamma,
            inertia_coefficient: rolling_stock_model.inertia_coefficient,
            mass: rolling_stock_model.mass,
            rolling_resistance: rolling_stock_model.rolling_resistance,
            loading_gauge: rolling_stock_model.loading_gauge,
            metadata: rolling_stock_model.metadata,
            power_restrictions: rolling_stock_model.power_restrictions,
            energy_sources: rolling_stock_model.energy_sources,
            supported_signaling_systems: rolling_stock_model.supported_signaling_systems,
        }
    }
}

// Light effort curves schema for LightRollingStock
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct LightModeEffortCurves {
    is_electric: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct LightEffortCurves {
    modes: HashMap<String, LightModeEffortCurves>,
    default_mode: String,
}
