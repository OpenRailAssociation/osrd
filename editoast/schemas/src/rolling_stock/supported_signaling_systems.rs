use std::str::FromStr;

use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumString;
use strum::FromRepr;
use utoipa::ToSchema;

#[derive(
    Clone, Debug, PartialEq, Deserialize, Serialize, Display, EnumString, FromRepr, ToSchema,
)]
pub enum SignalingSystem {
    BAL,
    BAPR,
    TVM300,
    TVM430,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RollingStockSupportedSignalingSystems(pub Vec<SignalingSystem>);

impl From<Vec<Option<String>>> for RollingStockSupportedSignalingSystems {
    fn from(features: Vec<Option<String>>) -> Self {
        Self(
            features
                .into_iter()
                .flatten()
                .flat_map(|s| SignalingSystem::from_str(&s).ok())
                .collect(),
        )
    }
}
impl From<RollingStockSupportedSignalingSystems> for Vec<Option<String>> {
    fn from(features: RollingStockSupportedSignalingSystems) -> Self {
        features
            .0
            .into_iter()
            .map(|s| Some(s.to_string()))
            .collect()
    }
}
