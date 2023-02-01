use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ElectricalProfileSet {
    pub levels: Value,
    #[serde(skip_serializing)]
    pub level_order: Value,
}
