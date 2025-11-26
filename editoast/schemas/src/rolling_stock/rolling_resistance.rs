use common::units;
use common::units::quantities::AerodynamicDrag;
use common::units::quantities::AerodynamicDragPerWeight;
use common::units::quantities::SolidFriction;
use common::units::quantities::SolidFrictionPerWeight;
use common::units::quantities::ViscosityFriction;
use common::units::quantities::ViscosityFrictionPerWeight;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[editoast_derive::annotate_units]
#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema, Educe)]
#[educe(Hash)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistance {
    #[serde(rename = "type")]
    pub rolling_resistance_type: String,
    /// Solid friction
    #[serde(with = "units::newton")]
    pub A: SolidFriction,
    /// Viscosity friction in N·(m/s)⁻¹; N = kg⋅m⋅s⁻²
    #[serde(with = "units::kilogram_per_second")]
    pub B: ViscosityFriction,
    /// Aerodynamic drag in N·(m/s)⁻²; N = kg⋅m⋅s⁻²
    #[serde(with = "units::kilogram_per_meter")]
    pub C: AerodynamicDrag,
}

#[editoast_derive::annotate_units]
#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema, Educe)]
#[educe(Hash)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistancePerWeight {
    #[serde(rename = "type")]
    pub rolling_resistance_type: String,
    /// Solid friction in N·kg⁻¹; N = kg⋅m⋅s⁻²
    #[serde(with = "units::meter_per_second_squared")]
    pub A: SolidFrictionPerWeight,
    /// Viscosity friction in (N·kg⁻¹)·(m/s)⁻¹; N = kg⋅m⋅s⁻²
    #[serde(with = "units::hertz")]
    pub B: ViscosityFrictionPerWeight,
    /// Aerodynamic drag per kg in (N·kg⁻¹)·(m/s)⁻²; N = kg⋅m⋅s⁻²
    #[serde(with = "units::per_meter")]
    pub C: AerodynamicDragPerWeight,
}
