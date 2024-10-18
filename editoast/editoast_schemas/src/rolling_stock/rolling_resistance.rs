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
    pub rolling_resistance_type: String,
    /// kN
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub A: f64,
    /// kN/(km/h)
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub B: f64,
    /// kN/(km/h)²
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub C: f64,
}

impl RollingResistance {
    pub fn new(rolling_resistance_type: String, a: f64, b: f64, c: f64) -> Self {
        Self {
            rolling_resistance_type,
            A: a,
            B: b,
            C: c,
        }
    }
}
