use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[derivative(Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Left,
    Right,
    #[derivative(Default)]
    Center,
}
