use crate::primitives::Identifier;
use derivative::Derivative;
use editoast_common::NonBlankString;
use serde::Deserialize;
use serde::Serialize;

use super::Direction;
use super::Side;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct Sign {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    pub side: Side,
    #[derivative(Default(value = r#"Direction::StartToStop"#))]
    pub direction: Direction,
    #[serde(rename = "type")]
    pub sign_type: NonBlankString,
    pub value: String,
    pub kp: String,
}
