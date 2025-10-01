use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use super::Side;

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[educe(Default)]
#[serde(deny_unknown_fields)]
pub struct Sign {
    #[educe(Default = "InvalidRef".into())]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    pub side: Side,
    #[educe(Default = Direction::StartToStop)]
    pub direction: Direction,
    #[serde(rename = "type")]
    #[schema(inline)]
    pub sign_type: NonBlankString,
    pub value: String,
    pub kp: String,
}
