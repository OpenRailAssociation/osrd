use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

use super::{
    rolling_stock_livery::RollingStockLiveryMetadata, EnergySource, Gamma, RollingResistance,
    RollingStockMetadata,
};
use crate::modelsv2::{
    rolling_stock_livery::RollingStockLiveryMetadataModel,
    rolling_stock_model::RollingStockSupportedSignalingSystems,
};

crate::schemas! {
    LightRollingStock,
    LightRollingStockWithLiveries,
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
    #[schema(value_type = LoadingGaugeType)]
    pub loading_gauge: String,
    pub metadata: RollingStockMetadata,
    #[schema(required)]
    pub power_restrictions: HashMap<String, String>,
    pub energy_sources: Vec<EnergySource>,
    #[serde(skip)]
    pub version: i64,
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

#[derive(Debug, Deserialize)]
pub struct LightRollingStockWithLiveriesModel {
    #[serde(flatten)]
    pub rolling_stock: LightRollingStock,
    pub liveries: Vec<RollingStockLiveryMetadataModel>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LightRollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: LightRollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

impl From<LightRollingStockWithLiveriesModel> for LightRollingStockWithLiveries {
    fn from(rolling_stock_with_liveries: LightRollingStockWithLiveriesModel) -> Self {
        LightRollingStockWithLiveries {
            rolling_stock: rolling_stock_with_liveries.rolling_stock,
            liveries: rolling_stock_with_liveries
                .liveries
                .into_iter()
                .map(|livery| livery.into())
                .collect(),
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
