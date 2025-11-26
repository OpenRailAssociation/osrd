use crate::rolling_stock::default_rolling_stock_railjson_version;

use super::RollingResistancePerWeight;
use common::unit_system::quantities::Acceleration;
use common::unit_system::quantities::Deceleration;
use common::unit_system::quantities::Length;
use common::unit_system::quantities::Mass;
use common::unit_system::quantities::Velocity;
use common::units;

#[editoast_derive::annotate_units]
#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[schema(as = TowedRollingStockForm)]
pub struct TowedRollingStock {
    pub name: String,
    pub label: String,
    #[schema(default = default_rolling_stock_railjson_version)]
    #[serde(default = "default_rolling_stock_railjson_version")]
    pub railjson_version: String,
    #[serde(with = "units::kilogram")]
    pub mass: Mass,
    #[serde(with = "units::meter")]
    pub length: Length,
    #[serde(with = "units::meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,
    #[serde(with = "units::meter_per_second_squared")]
    pub startup_acceleration: Acceleration,
    pub inertia_coefficient: f64,
    pub rolling_resistance: RollingResistancePerWeight,
    /// The constant gamma braking coefficient used when NOT circulating
    /// under ETCS/ERTMS signaling system
    #[serde(with = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,
    #[serde(default, with = "units::meter_per_second::option")]
    pub max_speed: Option<Velocity>,
}
