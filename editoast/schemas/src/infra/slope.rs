use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[editoast_derive::openapi_schema]
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    pub begin: f64,
    pub end: f64,
}
