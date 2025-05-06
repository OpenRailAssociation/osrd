use super::RollingResistancePerWeight;
use editoast_common::units;
use editoast_common::units::quantities::Acceleration;
use editoast_common::units::quantities::Deceleration;
use editoast_common::units::quantities::Length;
use editoast_common::units::quantities::Mass;
use editoast_common::units::quantities::Ratio;
use editoast_common::units::quantities::Velocity;

#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct TowedRollingStock {
    pub name: String,
    pub label: String,
    pub railjson_version: String,
    #[serde(with = "units::kilogram")]
    pub mass: Mass,
    #[serde(with = "units::meter")]
    pub length: Length,
    #[serde(with = "units::meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,
    #[serde(with = "units::meter_per_second_squared")]
    pub startup_acceleration: Acceleration,
    #[serde(with = "units::ratio")]
    pub inertia_coefficient: Ratio,
    pub rolling_resistance: RollingResistancePerWeight,
    /// The constant gamma braking coefficient used when NOT circulating
    /// under ETCS/ERTMS signaling system
    #[serde(with = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,
    #[serde(default, with = "units::meter_per_second::option")]
    pub max_speed: Option<Velocity>,
}
