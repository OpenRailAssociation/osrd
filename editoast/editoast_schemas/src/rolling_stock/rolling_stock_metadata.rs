use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema)]
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
