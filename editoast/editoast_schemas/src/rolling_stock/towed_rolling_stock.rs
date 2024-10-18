use super::Gamma;
use super::RollingResistance;

#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct TowedRollingStock {
    pub name: String,
    pub railjson_version: String,

    /// In kg
    pub mass: f64,
    /// In m
    pub length: f64,
    pub comfort_acceleration: f64,
    pub startup_acceleration: f64,
    pub inertia_coefficient: f64,
    pub rolling_resistance: RollingResistance,
    pub gamma: Gamma,
}
