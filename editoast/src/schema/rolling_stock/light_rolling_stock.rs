use diesel::sql_types::{Array, BigInt, Bool, Double, Jsonb, Nullable, Text};
use diesel_json::Json as DieselJson;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;

use super::{EnergySource, Gamma, RollingResistance, RollingStockMetadata};

crate::schemas! {
    LightRollingStock,
    LightRollingStockWithLiveries,
    LightModeEffortCurves,
    LightEffortCurves,
}

#[derive(Debug, QueryableByName, Deserialize, Serialize, ToSchema)]
pub struct LightRollingStock {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Text)]
    pub railjson_version: String,
    #[diesel(sql_type = Bool)]
    pub locked: bool,
    #[diesel(sql_type = Jsonb)]
    #[schema(value_type = LightEffortCurves)]
    pub effort_curves: DieselJson<LightEffortCurves>,
    #[diesel(sql_type = Nullable<Text>)]
    pub base_power_class: Option<String>,
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
    #[schema(value_type = Gamma)]
    pub gamma: DieselJson<Gamma>,
    #[diesel(sql_type = Double)]
    pub inertia_coefficient: f64,
    #[diesel(sql_type = Array<Text>)]
    pub features: Vec<String>,
    #[diesel(sql_type = Double)]
    pub mass: f64,
    #[diesel(sql_type = Jsonb)]
    #[schema(value_type = RollingResistance)]
    pub rolling_resistance: DieselJson<RollingResistance>,
    #[diesel(sql_type = Text)]
    pub loading_gauge: String,
    #[diesel(sql_type = Jsonb)]
    #[schema(value_type = RollingStockMetadata)]
    pub metadata: DieselJson<RollingStockMetadata>,
    #[diesel(sql_type = Nullable<Jsonb>)]
    #[schema(value_type = HashMap<String, String>)]
    pub power_restrictions: Option<JsonValue>,
    #[diesel(sql_type = Jsonb)]
    #[schema(value_type = Vec<EnergySource>)]
    pub energy_sources: DieselJson<Vec<EnergySource>>,
    #[serde(skip)]
    #[diesel(sql_type = BigInt)]
    pub version: i64,
}

#[derive(Debug, QueryableByName, Serialize, Deserialize, ToSchema)]
pub struct LightRollingStockWithLiveries {
    #[diesel(embed)]
    #[serde(flatten)]
    pub rolling_stock: LightRollingStock,
    #[diesel(sql_type = Array<Jsonb>)]
    #[schema(value_type = Vec<RollingStockLiveryMetadata>)]
    pub liveries: Vec<DieselJson<RollingStockLiveryMetadata>>,
}

// Light effort curves schema for LightRollingStock

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct LightModeEffortCurves {
    is_electric: bool,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct LightEffortCurves {
    modes: HashMap<String, LightModeEffortCurves>,
    default_mode: String,
}
