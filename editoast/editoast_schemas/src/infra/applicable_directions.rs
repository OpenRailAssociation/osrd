use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    ApplicableDirections,
}

#[derive(Debug, Default, Copy, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicableDirections {
    StartToStop,
    StopToStart,
    #[default]
    Both,
}
