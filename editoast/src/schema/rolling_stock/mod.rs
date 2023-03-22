pub mod light_rolling_stock;

use crate::schema::rolling_stock_livery::RollingStockLiveryMetadata;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Serialize)]
pub struct RollingStock {
    pub id: i64,
    pub name: String,
    pub version: String,
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
    pub metadata: RollingStockMetadata,
    pub power_restrictions: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: RollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Gamma {
    #[serde(rename = "type")]
    gamma_type: String,
    value: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistance {
    #[serde(rename = "type")]
    rolling_resistance_type: String,
    A: f64,
    B: f64,
    C: f64,
}

#[derive(Debug, Deserialize, Serialize)]
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

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum RollingStockComfortType {
    Standard,
    AC,
    Heating,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EffortCurveConditions {
    comfort: Option<RollingStockComfortType>,
    electrical_profile_level: Option<String>,
    power_restriction_code: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ConditionalEffortCurve {
    cond: EffortCurveConditions,
    curve: EffortCurve,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EffortCurve {
    speeds: Vec<f64>,
    max_efforts: Vec<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ModeEffortCurves {
    curves: Vec<ConditionalEffortCurve>,
    default_curve: EffortCurve,
    is_electric: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EffortCurves {
    modes: HashMap<String, ModeEffortCurves>,
    default_mode: String,
}
