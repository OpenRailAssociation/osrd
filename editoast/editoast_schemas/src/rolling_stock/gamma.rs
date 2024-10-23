use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    Gamma,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema, Derivative)]
#[serde(deny_unknown_fields)]
#[derivative(Hash)]
pub struct Gamma {
    #[serde(rename = "type")]
    pub gamma_type: String,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))]
    pub value: f64,
}
