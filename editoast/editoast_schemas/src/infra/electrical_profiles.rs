use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

use super::TrackRange;

#[editoast_derive::openapi_schema]
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ElectricalProfile {
    #[schema(example = "A")]
    pub value: String,
    #[schema(example = "1")]
    pub power_class: String,
    pub track_ranges: Vec<TrackRange>,
}

#[editoast_derive::openapi_schema]
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct LevelValues(Vec<String>);

#[editoast_derive::openapi_schema]
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ElectricalProfileSetData {
    pub levels: Vec<ElectricalProfile>,
    pub level_order: HashMap<String, LevelValues>,
}
