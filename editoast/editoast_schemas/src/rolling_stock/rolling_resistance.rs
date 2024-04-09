use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    RollingResistance,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema, Derivative)]
#[derivative(Hash)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistance {
    #[serde(rename = "type")]
    rolling_resistance_type: String,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    A: f64,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    B: f64,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    C: f64,
}
