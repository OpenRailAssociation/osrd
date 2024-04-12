use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Derivative, Copy, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[derivative(Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicableDirections {
    StartToStop,
    StopToStart,
    #[derivative(Default)]
    Both,
}
