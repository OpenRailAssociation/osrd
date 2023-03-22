use diesel::sql_types::{Array, BigInt, Double, Jsonb, Nullable, Text};
use diesel_json::Json as DieselJson;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;

use super::{Gamma, RollingResistance, RollingStockMetadata};

#[derive(Debug, QueryableByName, Deserialize, Serialize)]
pub struct LightRollingStock {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Text)]
    pub version: String,
    #[diesel(sql_type = Jsonb)]
    pub effort_curves: DieselJson<LightEffortCurves>,
    #[diesel(sql_type = Text)]
    pub base_power_class: String,
    #[diesel(sql_type = Double)]
    pub length: f64,
    #[diesel(sql_type = Double)]
    pub max_speed: f64,
    #[diesel(sql_type = Double)]
    pub startup_time: f64,
    #[diesel(sql_type = Double)]
    pub startup_acceleration: f64,
    #[diesel(sql_type = Double)]
    pub comfort_acceleration: f64,
    #[diesel(sql_type = Jsonb)]
    pub gamma: DieselJson<Gamma>,
    #[diesel(sql_type = Double)]
    pub inertia_coefficient: f64,
    #[diesel(sql_type = Array<Text>)]
    pub features: Vec<String>,
    #[diesel(sql_type = Double)]
    pub mass: f64,
    #[diesel(sql_type = Jsonb)]
    pub rolling_resistance: DieselJson<RollingResistance>,
    #[diesel(sql_type = Text)]
    pub loading_gauge: String,
    #[diesel(sql_type = Jsonb)]
    pub metadata: DieselJson<RollingStockMetadata>,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub power_restrictions: Option<JsonValue>,
}

#[derive(Debug, QueryableByName, Serialize)]
pub struct LightRollingStockWithLiveries {
    #[diesel(embed)]
    #[serde(flatten)]
    pub rolling_stock: LightRollingStock,
    #[diesel(sql_type = Array<Jsonb>)]
    pub liveries: Vec<DieselJson<RollingStockLiveryMetadata>>,
}

// Light effort curves schema for LightRollingStock

#[derive(Debug, Deserialize, Serialize)]
pub struct LightModeEffortCurves {
    is_electric: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LightEffortCurves {
    modes: HashMap<String, LightModeEffortCurves>,
    default_mode: String,
}
