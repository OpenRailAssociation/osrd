use std::collections::HashMap;

use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::ModeEffortCurves;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;

use crate::modelsv2::RollingStockModel;

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

impl From<RollingStockModel> for LightRollingStock {
    fn from(
        RollingStockModel {
            id,
            railjson_version,
            name,
            effort_curves,
            metadata,
            length,
            max_speed,
            startup_time,
            startup_acceleration,
            comfort_acceleration,
            gamma,
            inertia_coefficient,
            base_power_class,
            mass,
            rolling_resistance,
            loading_gauge,
            power_restrictions,
            energy_sources,
            locked,
            supported_signaling_systems,
            ..
        }: RollingStockModel,
    ) -> Self {
        LightRollingStock {
            id,
            name,
            railjson_version,
            locked,
            effort_curves: effort_curves.into(),
            base_power_class,
            length,
            max_speed,
            startup_time,
            startup_acceleration,
            comfort_acceleration,
            gamma,
            inertia_coefficient,
            mass,
            rolling_resistance,
            loading_gauge,
            metadata,
            power_restrictions,
            energy_sources,
            supported_signaling_systems,
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

impl From<EffortCurves> for LightEffortCurves {
    fn from(
        EffortCurves {
            modes,
            default_mode,
        }: EffortCurves,
    ) -> Self {
        let modes = modes
            .into_iter()
            .map(|(mode, curve)| (mode, curve.into()))
            .collect();
        Self {
            modes,
            default_mode,
        }
    }
}

impl From<ModeEffortCurves> for LightModeEffortCurves {
    fn from(value: ModeEffortCurves) -> Self {
        Self {
            is_electric: value.is_electric,
        }
    }
}
