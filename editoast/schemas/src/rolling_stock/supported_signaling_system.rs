use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumString;
use strum::FromRepr;
use utoipa::ToSchema;

use crate::rolling_stock::EtcsBrakeParams;

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
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
pub enum RollingStockSupportedSignalingSystem {
    Simple(SignalingSystem),
    EtcsLevel2 { brake_params: EtcsBrakeParams },
}

impl ToString for RollingStockSupportedSignalingSystem {
    fn to_string(&self) -> String {
        match self {
            RollingStockSupportedSignalingSystem::Simple(system) => system.to_string(),
            RollingStockSupportedSignalingSystem::EtcsLevel2 { .. } => "ETCS_LEVEL2".to_string(),
        }
    }
}
