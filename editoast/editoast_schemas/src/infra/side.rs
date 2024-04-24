use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    Side,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[derivative(Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Left,
    Right,
    #[derivative(Default)]
    Center,
}
