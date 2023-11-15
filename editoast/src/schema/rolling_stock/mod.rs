pub mod light_rolling_stock;
pub mod rolling_stock_livery;

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use strum_macros::{Display, EnumString};
use utoipa::ToSchema;

use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;

crate::schemas! {
    RollingStockComfortType,
    RollingStockCommon,
    RollingStockWithLiveries,
    RollingResistance,
    RollingStockMetadata,
    RollingStockLiveryMetadata,
    RollingStockComfortType,
    Gamma,
    EffortCurve,
    EffortCurves,
    EffortCurveConditions,
    ConditionalEffortCurve,
    ModeEffortCurves,
    EnergySource,
    SpeedDependantPower,
    EnergyStorage,
    RefillLaw,
    light_rolling_stock::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.2";

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RollingStockCommon {
    pub name: String,
    pub effort_curves: EffortCurves,
    #[schema(example = "5")]
    pub base_power_class: Option<String>,
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
    #[schema(value_type = LoadingGaugeType)]
    pub loading_gauge: String,
    /// Mapping of power restriction code to power class
    #[schema(value_type = HashMap<String, String>)]
    pub power_restrictions: Option<JsonValue>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    /// The time the train takes before actually using electrical power (in seconds). Is null if the train is not electric.
    #[schema(example = 5.0)]
    pub electrical_power_startup_time: Option<f64>,
    /// The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric.
    #[schema(example = 15.0)]
    pub raise_pantograph_time: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RollingStock {
    pub id: i64,
    #[serde(flatten)]
    pub common: RollingStockCommon,
    pub railjson_version: String,
    /// Whether the rolling stock can be edited/deleted or not.
    pub locked: bool,
    pub metadata: RollingStockMetadata,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: RollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct Gamma {
    #[serde(rename = "type")]
    gamma_type: String,
    value: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistance {
    #[serde(rename = "type")]
    rolling_resistance_type: String,
    A: f64,
    B: f64,
    C: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
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
#[derive(
    Display, Clone, Default, Debug, EnumString, PartialEq, Deserialize, Serialize, ToSchema,
)]
#[strum(serialize_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum RollingStockComfortType {
    #[default]
    Standard,
    AC,
    Heating,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EffortCurveConditions {
    comfort: Option<RollingStockComfortType>,
    electrical_profile_level: Option<String>,
    power_restriction_code: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ConditionalEffortCurve {
    cond: EffortCurveConditions,
    curve: EffortCurve,
}

#[derive(Clone, Debug, PartialEq, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EffortCurve {
    #[schema(min_items = 2, example = json!([0.0, 2.958, 46.719]))]
    speeds: Vec<f64>,
    #[schema(min_items = 2, example = json!([23500.0, 23200.0, 21200.0]))]
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

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ModeEffortCurves {
    curves: Vec<ConditionalEffortCurve>,
    default_curve: EffortCurve,
    is_electric: bool,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EffortCurves {
    modes: HashMap<String, ModeEffortCurves>,
    default_mode: String,
}

// Energy sources schema

/// physical law defining how the storage can be refilled
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct RefillLaw {
    #[schema(minimum = 0)]
    tau: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_ref: f64,
}

/// energy storage of an energy source (of a rolling stock, can be a electrical battery or a hydrogen/fuel powerPack)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EnergyStorage {
    capacity: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_min: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_max: f64,
    refill_law: Option<RefillLaw>,
}

/// power-speed curve (in an energy source)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SpeedDependantPower {
    speeds: Vec<f64>,
    powers: Vec<f64>,
}

/// energy source of a rolling stock
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(tag = "energy_source_type", deny_unknown_fields)]
pub enum EnergySource {
    /// energy source for a rolling stock representing a catenary
    Catenary {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
    PowerPack {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
    /// energy source for a rolling stock representing a battery
    Battery {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        #[schema(minimum = 0, maximum = 1)]
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
