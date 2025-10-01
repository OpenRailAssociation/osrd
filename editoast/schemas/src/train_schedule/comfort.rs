use serde::Deserialize;
use serde::Serialize;
use strum::FromRepr;
use utoipa::ToSchema;

#[derive(
    Debug, Default, PartialEq, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, Hash,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Comfort {
    #[default]
    Standard,
    AirConditioning,
    Heating,
}
