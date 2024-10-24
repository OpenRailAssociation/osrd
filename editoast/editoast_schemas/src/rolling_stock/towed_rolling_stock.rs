use super::Gamma;
use super::RollingResistance;

#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct TowedRollingStock {
    pub name: String,
    pub description: String,
    pub railjson_version: String,

    pub mass: f64,
    pub length: f64,
    pub comfort_acceleration: f64,
    pub startup_acceleration: f64,
    pub inertia_coefficient: f64,
    pub rolling_resistance: RollingResistance,
    pub gamma: Gamma,
}
