use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Endpoint {
    Begin,
    End,
}
