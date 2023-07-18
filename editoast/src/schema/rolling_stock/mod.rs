pub mod light_rolling_stock;
pub mod rolling_stock_livery;

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct RollingStockCommon {
    pub name: String,
    pub railjson_version: String,
    pub effort_curves: EffortCurves,
    pub base_power_class: String,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: Gamma,
    pub inertia_coefficient: f64,
    pub features: Vec<String>,
    pub mass: f64,
    pub rolling_resistance: RollingResistance,
    pub loading_gauge: String,
    pub power_restrictions: Option<JsonValue>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    pub electrical_power_startup_time: Option<f64>,
    pub raise_pantograph_time: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct RollingStock {
    pub id: i64,
    #[serde(flatten)]
    pub common: RollingStockCommon,
    pub locked: bool,
    pub metadata: RollingStockMetadata,
}

#[derive(Debug, Serialize)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: RollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Gamma {
    #[serde(rename = "type")]
    gamma_type: String,
    value: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistance {
    #[serde(rename = "type")]
    rolling_resistance_type: String,
    A: f64,
    B: f64,
    C: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RollingStockMetadata {
    detail: String,
    family: String,
    #[serde(rename = "type")]
    rolling_stock_type: String,
    grouping: String,
    series: String,
    subseries: String,
    unit: String,
    number: String,
    reference: String,
}

// Effort curves schema

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum RollingStockComfortType {
    Standard,
    AC,
    Heating,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EffortCurveConditions {
    comfort: Option<RollingStockComfortType>,
    electrical_profile_level: Option<String>,
    power_restriction_code: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ConditionalEffortCurve {
    cond: EffortCurveConditions,
    curve: EffortCurve,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EffortCurve {
    speeds: Vec<f64>,
    max_efforts: Vec<f64>,
}

impl<'de> Deserialize<'de> for EffortCurve {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct InnerParams {
            speeds: Vec<f64>,
            max_efforts: Vec<f64>,
        }

        let inner = InnerParams::deserialize(deserializer)?;

        // Validate the curve
        if inner.max_efforts.len() != inner.speeds.len() {
            return Err(serde::de::Error::custom(
                "effort curve invalid, max_efforts and speeds arrays should have the same length",
            ));
        }

        Ok(EffortCurve {
            speeds: inner.speeds,
            max_efforts: inner.max_efforts,
        })
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ModeEffortCurves {
    curves: Vec<ConditionalEffortCurve>,
    default_curve: EffortCurve,
    is_electric: bool,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EffortCurves {
    modes: HashMap<String, ModeEffortCurves>,
    default_mode: String,
}

// Energy sources schema

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RefillLaw {
    tau: f64,
    soc_ref: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EnergyStorage {
    capacity: f64,
    soc: f64,
    soc_min: f64,
    soc_max: f64,
    refill_law: Option<RefillLaw>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SpeedDependantPower {
    speeds: Vec<f64>,
    powers: Vec<f64>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "energy_source_type", deny_unknown_fields)]
pub enum EnergySource {
    Catenary {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        efficiency: f64,
    },
    PowerPack {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        efficiency: f64,
    },
    Battery {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        efficiency: f64,
    },
}

#[cfg(test)]
mod tests {
    use crate::schema::rolling_stock::EffortCurve;

    #[test]
    fn test_de_effort_curve_valid() {
        assert!(serde_json::from_str::<EffortCurve>(
            r#"{ "speeds": [0, 1], "max_efforts": [0, 2] }"#
        )
        .is_ok());
    }

    #[test]
    fn test_de_effort_curve_unvalid() {
        assert!(
            serde_json::from_str::<EffortCurve>(r#"{ "speeds": [0, 1], "max_efforts": [] }"#)
                .is_err()
        );
    }
}
