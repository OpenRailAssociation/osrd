use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_common::units;
use editoast_common::units::quantities::Length;

use crate::rolling_stock::LoadingGaugeType;

editoast_common::schemas! {
    LoadingGaugeLimit,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct LoadingGaugeLimit {
    pub category: LoadingGaugeType,
    #[serde(with = "units::millimeter")]
    pub begin: Length,
    #[serde(with = "units::millimeter")]
    pub end: Length,
}
