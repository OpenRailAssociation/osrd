use std::borrow::Borrow;

use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

use crate::rolling_stock::EtcsBrakeParams;

#[derive(Clone, Debug, Deserialize, Serialize, Display, Educe, ToSchema, strum::IntoStaticStr)]
#[educe(Hash, Eq, PartialEq)]
#[serde(tag = "type")]
#[allow(clippy::large_enum_variant)]
pub enum SupportedSignalingSystem {
    BAL,
    BAPR,
    TVM300,
    TVM430,
    // /!\ Must be the same value than [SupportedSignalingSystem::ETCS_LEVEL2_VARIANT_NAME]
    #[strum(to_string = "ETCS_LEVEL2")]
    #[serde(rename = "ETCS_LEVEL2")]
    EtcsLevel2 {
        brake_params: EtcsBrakeParams,
    },
}

impl SupportedSignalingSystem {
    // /!\ Must be the same value than the serialization of that variant
    // look for `#[serde(rename)]` and `#[strum(to_string)]`
    pub const ETCS_LEVEL2_VARIANT_NAME: &str = "ETCS_LEVEL2";
}

impl Borrow<str> for SupportedSignalingSystem {
    fn borrow(&self) -> &str {
        self.into()
    }
}
