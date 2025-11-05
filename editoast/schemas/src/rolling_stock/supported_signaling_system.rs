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

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, Display, ToSchema)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
pub enum RollingStockSupportedSignalingSystem {
    #[strum(to_string = "{0}")]
    Simple(SignalingSystem),
    #[strum(to_string = "ETCS_LEVEL2")]
    EtcsLevel2 { brake_params: EtcsBrakeParams },
}
