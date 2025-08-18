use serde::Deserialize;
use serde::Serialize;
use strum::FromRepr;
use utoipa::ToSchema;

#[editoast_derive::openapi_schema]
#[derive(
    Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, FromRepr, ToSchema, Hash,
)]
#[serde(rename_all = "UPPERCASE")]
pub enum Distribution {
    #[default]
    Standard,
    Mareco,
}
