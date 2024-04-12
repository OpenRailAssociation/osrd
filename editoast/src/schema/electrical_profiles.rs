use std::collections::HashMap;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_schemas::infra::TrackRange;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ElectricalProfile {
    #[schema(example = "A")]
    pub value: String,
    #[schema(example = "1")]
    pub power_class: String,
    pub track_ranges: Vec<TrackRange>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct LevelValues(Vec<String>);

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ElectricalProfileSetData {
    pub levels: Vec<ElectricalProfile>,
    pub level_order: HashMap<String, LevelValues>,
}
