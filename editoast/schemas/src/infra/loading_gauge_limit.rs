use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock::LoadingGaugeType;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct LoadingGaugeLimit {
    pub category: LoadingGaugeType,
    pub begin: f64,
    pub end: f64,
}
