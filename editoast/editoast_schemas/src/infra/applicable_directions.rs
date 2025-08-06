use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[editoast_derive::openapi_schema]
#[derive(Debug, Default, Copy, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicableDirections {
    StartToStop,
    StopToStart,
    #[default]
    Both,
}
