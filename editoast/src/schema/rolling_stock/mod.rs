pub mod light_rolling_stock;
pub mod rolling_stock_livery;

use diesel_json::Json as DieselJson;
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use strum_macros::{Display, EnumString};
use utoipa::ToSchema;

use crate::{
    models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata,
    schema::rolling_stock::rolling_stock_livery::RollingStockLivery,
};
crate::schemas! {
    RollingStockComfortType,
    RollingStockCommon,
    RollingStockWithLiveries,
    RollingResistance,
    RollingStockMetadata,
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
    RollingStockLivery,
    light_rolling_stock::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.2";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RollingStockCommon {
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
    #[schema(value_type = LoadingGaugeType)]
    pub loading_gauge: String,
    /// Mapping of power restriction code to power class
    #[schema(value_type = HashMap<String, String>)]
    pub power_restrictions: Option<DieselJson<HashMap<String, String>>>,
    #[serde(default)]
    pub energy_sources: Vec<EnergySource>,
    /// The time the train takes before actually using electrical power (in seconds). Is null if the train is not electric.
    #[schema(example = 5.0)]
    pub electrical_power_startup_time: Option<f64>,
    /// The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric.
    #[schema(example = 15.0)]
    pub raise_pantograph_time: Option<f64>,
    pub supported_signaling_systems: Vec<String>,
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

/// Train comfort that will be used for the simulation
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
    #[schema(required)]
    comfort: Option<RollingStockComfortType>,
    #[schema(required)]
    electrical_profile_level: Option<String>,
    #[schema(required)]
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

        if inner.max_efforts.len() < 2 {
            return Err(serde::de::Error::custom(
                "effort curve should have at least 2 points.",
            ));
        }

        if inner.max_efforts.iter().any(|&x| x < 0.0) {
            return Err(serde::de::Error::custom(
                "max_efforts values must be equal or greater than 0.",
            ));
        };

        if inner.speeds.iter().any(|&x| x < 0.0) {
            return Err(serde::de::Error::custom(
                "speeds values must be equal or greater than 0.",
            ));
        };

        if inner.speeds.windows(2).any(|window| window[0] >= window[1]) {
            return Err(serde::de::Error::custom(
                "speeds values must be strictly increasing.",
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
    pub is_electric: bool,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EffortCurves {
    pub modes: HashMap<String, ModeEffortCurves>,
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
    #[schema(required)]
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
    /// energy source for a rolling stock representing a electrification
    Electrification {
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
    use serde_json::{from_value, json};

    #[test]
    fn test_de_effort_curve_valid() {
        let curve = json!({ "speeds": [0, 1], "max_efforts": [0, 2] });
        assert!(from_value::<EffortCurve>(curve).is_ok());
    }

    #[test]
    fn test_effort_curve_invalid_due_to_single_point() {
        let curve = json!({ "speeds": [0], "max_efforts": [0] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_mismatched_lengths() {
        let curve = json!({ "speeds": [0, 1], "max_efforts": [] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_negative_max_efforts() {
        let curve = json!({ "speeds": [0, 1, 2], "max_efforts": [5, 4, -3] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_negative_speeds() {
        let curve = json!({ "speeds": [-1, 0, 1], "max_efforts": [5, 4, 3] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_unordered_speeds() {
        let curve = json!({ "speeds": [0, 2, 1], "max_efforts": [5, 4, 3] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }
}
