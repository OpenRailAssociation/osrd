use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    ApplicableDirections,
}

#[derive(Debug, Derivative, Copy, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[derivative(Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicableDirections {
    StartToStop,
    StopToStart,
    #[derivative(Default)]
    Both,
}
