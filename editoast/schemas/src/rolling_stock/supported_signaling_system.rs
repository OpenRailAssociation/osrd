use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

use crate::rolling_stock::EtcsBrakeParams;

#[derive(Clone, Debug, Deserialize, Serialize, Display, Educe, ToSchema)]
#[educe(Hash, Eq, PartialEq)]
#[serde(tag = "type")]
pub enum SupportedSignalingSystem {
    BAL,
    BAPR,
    TVM300,
    TVM430,
    #[strum(to_string = "ETCS_LEVEL2")]
    #[serde(rename = "ETCS_LEVEL2")]
    EtcsLevel2 {
        #[educe(Hash(ignore), PartialEq(ignore))]
        brake_params: EtcsBrakeParams,
    },
}
