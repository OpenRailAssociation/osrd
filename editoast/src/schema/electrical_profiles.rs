use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::schema::TrackRange;

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ElectricalProfile {
    pub value: String,
    pub power_class: String,
    pub track_ranges: Vec<TrackRange>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ElectricalProfileSetData {
    pub levels: Vec<ElectricalProfile>,
    pub level_order: HashMap<String, Vec<String>>,
}
