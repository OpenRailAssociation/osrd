use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    Endpoint,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum Endpoint {
    Begin,
    End,
}
