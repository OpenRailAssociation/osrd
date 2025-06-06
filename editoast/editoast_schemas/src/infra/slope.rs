use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_common::units;
use editoast_common::units::quantities::Length;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    #[serde(with = "units::millimeter")]
    pub begin: Length,
    #[serde(with = "units::millimeter")]
    pub end: Length,
}
