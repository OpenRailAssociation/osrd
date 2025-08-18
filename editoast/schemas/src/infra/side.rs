use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[editoast_derive::openapi_schema]
#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Side {
    Left,
    Right,
    #[default]
    Center,
}
