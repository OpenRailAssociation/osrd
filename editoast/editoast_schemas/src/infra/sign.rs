use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use super::Side;

editoast_common::schemas! {
    Sign,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct Sign {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    pub side: Side,
    #[derivative(Default(value = r#"Direction::StartToStop"#))]
    pub direction: Direction,
    #[serde(rename = "type")]
    #[schema(inline)]
    pub sign_type: NonBlankString,
    pub value: String,
    pub kp: String,
}
