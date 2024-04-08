pub mod light_rolling_stock;

use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockCommon;
use editoast_schemas::rolling_stock::RollingStockLiveryMetadata;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    RollingStockWithLiveries,
    editoast_schemas::rolling_stock::schemas(),
    light_rolling_stock::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.2";

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
