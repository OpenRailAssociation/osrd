use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    pub begin: f64,
    pub end: f64,
}
